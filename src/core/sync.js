// How the app's state maps onto the online database, as pure functions.
//
// Firestore layout, all under users/{uid}/data/:
//   main    everything except the history: launchers, habits, rituals, goals
//   2026    that year's history: { checks: {day: …}, runs: {ritual: {period: …}} }
// One document per year keeps each far below Firestore's per-document limits
// (1 MiB, 40,000 index entries) however many years the record grows.
//
// Changes travel as leaf-level operations from diff(): "checks.2026-10-01.mn
// = true", never "here is the whole day". Two devices ticking different
// habits on the same day therefore both land. Arrays (the habit list, goals)
// are written whole: they only change by editing, one device at a time.

const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const clone = (x) => JSON.parse(JSON.stringify(x));

// Deep equality that ignores key order (Firestore hands maps back sorted).
export function same(a, b) {
  if (a === b) return true;
  if (Array.isArray(a)) return Array.isArray(b) && a.length === b.length && a.every((x, i) => same(x, b[i]));
  if (!isObj(a) || !isObj(b)) return false;
  const ka = Object.keys(a);
  return ka.length === Object.keys(b).length && ka.every((k) => k in b && same(a[k], b[k]));
}

function addAll(v, path, ops) {
  const keys = Object.keys(v);
  if (!keys.length) ops.push({ path, value: {} });
  for (const k of keys) {
    if (isObj(v[k])) addAll(v[k], [...path, k], ops);
    else ops.push({ path: [...path, k], value: clone(v[k]) });
  }
}

function removeAll(v, path, ops) {
  const keys = isObj(v) ? Object.keys(v) : [];
  if (!keys.length) ops.push({ path, del: true });
  for (const k of keys) removeAll(v[k], [...path, k], ops);
}

// What changed from a to b, as [{ path, value } | { path, del: true }].
export function diff(a, b, path = [], ops = []) {
  for (const k of new Set([...Object.keys(a || {}), ...Object.keys(b || {})])) {
    const x = a ? a[k] : undefined;
    const y = b ? b[k] : undefined;
    const p = [...path, k];
    if (y === undefined) removeAll(x, p, ops);
    else if (isObj(x) && isObj(y)) diff(x, y, p, ops);
    else if (isObj(y)) addAll(y, p, ops);
    else if (!same(x, y)) ops.push({ path: p, value: clone(y) });
  }
  return ops;
}

// Which document a path lives in. null for the bare `checks` / `runs.<id>`
// containers, which only exist implicitly (diff never puts data there).
export function docOf(path) {
  if (path[0] === 'checks') return path.length > 1 ? path[1].slice(0, 4) : null;
  if (path[0] === 'runs') return path.length > 2 ? path[2].slice(0, 4) : null;
  return 'main';
}

export function toDocs(state) {
  const { checks = {}, runs = {}, ...rest } = clone(state);
  const docs = { main: rest };
  const year = (key) => (docs[key.slice(0, 4)] = docs[key.slice(0, 4)] || { checks: {}, runs: {} });
  for (const [day, v] of Object.entries(checks)) year(day).checks[day] = v;
  for (const [id, periods] of Object.entries(runs)) {
    for (const [p, run] of Object.entries(periods)) {
      const r = year(p).runs;
      (r[id] = r[id] || {})[p] = run;
    }
  }
  return docs;
}

export function fromDocs(docs) {
  const { main, ...years } = clone(docs);
  const s = { ...main, checks: {}, runs: {} };
  for (const y of Object.keys(years).sort()) {
    Object.assign(s.checks, years[y].checks);
    for (const [id, periods] of Object.entries(years[y].runs || {})) Object.assign((s.runs[id] = s.runs[id] || {}), periods);
  }
  return s;
}

// Operations -> one merge-write per document. `DEL` is whatever the
// database uses to mean "remove this field" (Firestore's deleteField()).
export function patchesFor(ops, DEL) {
  const docs = {};
  for (const op of ops) {
    const id = docOf(op.path);
    if (!id) continue;
    let o = (docs[id] = docs[id] || {});
    for (const k of op.path.slice(0, -1)) {
      if (!isObj(o[k])) o[k] = {};
      o = o[k];
    }
    o[op.path[op.path.length - 1]] = op.del ? DEL : clone(op.value);
  }
  return Object.entries(docs).map(([id, data]) => ({ id, data, merge: true }));
}

// Firestore's merge-write, for the tests and the pretend server: a non-empty
// map merges key by key, anything else (values, arrays, {}) replaces.
export function applyMerge(target, patch, DEL) {
  for (const [k, v] of Object.entries(patch)) {
    if (v === DEL) delete target[k];
    else if (isObj(v) && Object.keys(v).length) {
      if (!isObj(target[k])) target[k] = {};
      applyMerge(target[k], v, DEL);
    } else target[k] = clone(v);
  }
  return target;
}
