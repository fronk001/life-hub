// Wins: what actually got done in a month, counted from real ticks and runs.

import { monthKey } from './dates.js';

const plural = (n, noun) => (n === 1 ? noun.replace(/s$/, '') : noun);

export function monthWins(state, mKey) {
  const items = [];
  let total = 0;

  for (const h of state.habits) {
    const n = Object.keys(state.checks).filter((d) => monthKey(d) === mKey && state.checks[d][h.id]).length;
    if (!n) continue;
    total += n;
    items.push({ label: `${n} ${plural(n, h.winNoun || `${h.name} days`)}`, tone: 'green' });
  }

  for (const r of state.rituals) {
    const runs = Object.values(state.runs[r.id] || {}).filter((x) => x.done && x.doneDay && monthKey(x.doneDay) === mKey);
    if (!runs.length) continue;
    total += runs.length;
    if (r.schedule.type === 'monthly') {
      for (const x of runs) items.push({ label: x.minutes ? `${r.name} · ${x.minutes} min` : r.name, tone: 'amber' });
    } else {
      items.push({ label: `${runs.length} ${plural(runs.length, r.winNoun || `${r.name} sessions`)}`, tone: 'green' });
    }
  }

  // Green chips first, the monthly ritual last, as in the mockup.
  items.sort((a, b) => (a.tone === b.tone ? 0 : a.tone === 'amber' ? 1 : -1));
  return { total, items };
}
