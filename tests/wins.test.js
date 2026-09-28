import { test, eq } from './harness.js';
import { state, ticks } from './fixtures.js';
import { monthWins } from '../src/core/wins.js';

test('month wins count real ticks and runs, singular when there is one', () => {
  const checks = ticks('mn', ['2026-10-01', '2026-10-02', '2026-09-30']);
  ticks('ride', ['2026-10-03'], checks);
  const runs = {
    groceries: { '2026-W40': { done: true, doneDay: '2026-10-04' }, '2026-W41': { done: true, doneDay: '2026-10-11' } },
    money: { '2026-10': { done: true, doneDay: '2026-10-04', minutes: 52 } },
  };
  const w = monthWins(state({ checks, runs }), '2026-10');
  eq(w.total, 6);
  eq(w.items.map((i) => i.label), ['2 Mongolian sessions', '1 dressage lesson', '2 grocery runs', 'Money review · 52 min']);
  eq(w.items[3].tone, 'amber');
});

test('an empty month has no wins', () => {
  eq(monthWins(state(), '2026-10'), { total: 0, items: [] });
});
