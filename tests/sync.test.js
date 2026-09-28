import { test, eq, ok } from './harness.js';
import { state, ticks, MIN } from './fixtures.js';
import { setGoalPct, startRitual, toggleHabit, toggleRitualDone, toggleStep } from '../src/core/actions.js';
import { applyMerge, diff, docOf, fromDocs, patchesFor, same, toDocs } from '../src/core/sync.js';

const DEL = Symbol('del');
const T0 = Date.UTC(2026, 9, 4, 10, 0);
const clone = (x) => JSON.parse(JSON.stringify(x));

// What the server would hold after these patches.
function applyAll(docs, patches) {
  const out = clone(docs);
  for (const p of patches) out[p.id] = applyMerge(out[p.id] || {}, p.data, DEL);
  return out;
}

// A day whose last tick was removed stays behind online as an empty map; it
// means nothing, so compare without those.
function prune(s) {
  const c = clone(s);
  for (const d of Object.keys(c.checks)) if (!Object.keys(c.checks[d]).length) delete c.checks[d];
  return c;
}

const history = () => state({
  checks: ticks('mn', ['2026-09-28', '2026-09-29', '2027-01-02']),
  runs: { groceries: { '2026-W40': { steps: {}, done: true, doneDay: '2026-10-04' }, '2026-W53': { steps: {} } } },
  goals: [{ id: 'g', level: 'year', period: '2026', title: 'Read', measure: { type: 'manual', pct: 10 } }],
});

test('same() ignores key order, not values', () => {
  ok(same({ a: 1, b: [{ x: 1, y: 2 }] }, { b: [{ y: 2, x: 1 }], a: 1 }));
  ok(!same({ a: [1, 2] }, { a: [2, 1] }));
  ok(!same({ a: 1 }, { a: 1, b: undefined }));
});

test('a tick is one small change, not the whole day', () => {
  const s0 = state({ checks: ticks('gym', ['2026-10-01']) });
  eq(diff(s0, toggleHabit(s0, 'mn', '2026-10-01')), [{ path: ['checks', '2026-10-01', 'mn'], value: true }]);
});

test('un-ticking the last habit of a day removes just that tick', () => {
  const s0 = state({ checks: ticks('mn', ['2026-10-01']) });
  eq(diff(s0, toggleHabit(s0, 'mn', '2026-10-01')), [{ path: ['checks', '2026-10-01', 'mn'], del: true }]);
});

test('a goal percentage rewrites the goal list, nothing else', () => {
  const s0 = history();
  const ops = diff(s0, setGoalPct(s0, 'g', 40));
  eq(ops.map((o) => o.path), [['goals']]);
  eq(ops[0].value[0].measure.pct, 40);
});

test('the first step of a run creates the run field by field', () => {
  const s0 = state();
  const ops = diff(s0, toggleStep(s0, 'money', 'numbers', '2026-10-04', T0));
  eq(ops, [
    { path: ['runs', 'money', '2026-10', 'steps', 'numbers'], value: true },
    { path: ['runs', 'money', '2026-10', 'startedAt'], value: T0 },
  ]);
  ok(ops.every((o) => docOf(o.path) === '2026'), 'all in the 2026 document');
});

test('history is filed by year; the rest goes in main', () => {
  const docs = toDocs(history());
  eq(Object.keys(docs).sort(), ['2026', '2027', 'main']);
  ok(!('checks' in docs.main) && !('runs' in docs.main), 'main holds no history');
  eq(Object.keys(docs['2026'].checks), ['2026-09-28', '2026-09-29']);
  eq(Object.keys(docs['2027'].checks), ['2027-01-02']);
  // ISO week 53 of 2026 ends in January 2027, but belongs with its key's year.
  eq(Object.keys(docs['2026'].runs.groceries).sort(), ['2026-W40', '2026-W53']);
  eq(docOf(['runs', 'money', '2027-01', 'done']), '2027');
  eq(docOf(['checks']), null);
  eq(docOf(['habits']), 'main');
});

test('documents read back as the same state', () => {
  const s = history();
  ok(same(fromDocs(toDocs(s)), s));
});

test('every action, sent as patches, leaves the server matching the device', () => {
  let s = history();
  let server = toDocs(s);
  const steps = [
    (x) => toggleHabit(x, 'mn', '2026-10-01'),
    (x) => toggleHabit(x, 'gym', '2026-10-01'),
    (x) => toggleHabit(x, 'mn', '2026-10-01'),
    (x) => toggleHabit(x, 'gym', '2026-10-01'), // the day is empty again
    (x) => toggleHabit(x, 'mn', '2027-01-03'),
    (x) => startRitual(x, 'groceries', '2026-10-11', T0),
    (x) => toggleRitualDone(x, 'groceries', '2026-10-11', T0 + 30 * MIN),
    (x) => toggleStep(x, 'money', 'numbers', '2026-10-04', T0),
    (x) => toggleStep(x, 'money', 'wealth', '2026-10-04', T0 + 50 * MIN),
    (x) => toggleStep(x, 'money', 'wealth', '2026-10-04', T0 + 51 * MIN), // reopens the run
    (x) => setGoalPct(x, 'g', 55),
  ];
  for (const [i, step] of steps.entries()) {
    const next = step(s);
    server = applyAll(server, patchesFor(diff(s, next), DEL));
    ok(same(prune(fromDocs(server)), prune(next)), `after step ${i + 1}`);
    s = next;
  }
});

test('two devices ticking different habits on the same new day both land', () => {
  const s0 = state();
  const laptop = toggleHabit(s0, 'gym', '2026-10-01');
  const phone = toggleHabit(s0, 'mn', '2026-10-01');
  let server = toDocs(s0);
  server = applyAll(server, patchesFor(diff(s0, laptop), DEL));
  server = applyAll(server, patchesFor(diff(s0, phone), DEL));
  eq(fromDocs(server).checks, { '2026-10-01': { gym: true, mn: true } });
});

test('removed fields are marked for deletion in their own document', () => {
  const s0 = history();
  const p = patchesFor(diff(s0, toggleHabit(s0, 'mn', '2027-01-02')), DEL);
  eq(p.length, 1);
  eq(p[0].id, '2027');
  ok(p[0].data.checks['2027-01-02'].mn === DEL);
  ok(p[0].merge);
});
