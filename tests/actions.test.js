import { test, eq } from './harness.js';
import { state, MIN } from './fixtures.js';
import { setGoalPct, startRitual, toggleHabit, toggleRitualDone, toggleStep } from '../src/core/actions.js';

const T0 = Date.UTC(2026, 9, 4, 10, 0);

test('ticking a habit twice leaves no trace', () => {
  const s1 = toggleHabit(state(), 'mn', '2026-10-01');
  eq(s1.checks, { '2026-10-01': { mn: true } });
  eq(toggleHabit(s1, 'mn', '2026-10-01').checks, {});
});

test('actions never mutate the state they are given', () => {
  const s0 = state();
  toggleHabit(s0, 'mn', '2026-10-01');
  eq(s0.checks, {});
});

test('money review: required steps finish it, the optional one does not hold it open', () => {
  let s = toggleStep(state(), 'money', 'numbers', '2026-10-04', T0);
  eq(!!s.runs.money['2026-10'].done, false);
  s = toggleStep(s, 'money', 'wealth', '2026-10-04', T0 + 52 * MIN);
  const run = s.runs.money['2026-10'];
  eq([run.done, run.doneDay, run.minutes], [true, '2026-10-04', 52]);
  s = toggleStep(s, 'money', 'wealth', '2026-10-04', T0 + 53 * MIN);
  eq(s.runs.money['2026-10'].done, false, 'un-ticking reopens it');
  eq(s.runs.money['2026-10'].minutes, undefined);
});

test('a step ticked before the ritual existed lands in the active period', () => {
  const s = toggleStep(state(), 'money', 'numbers', '2026-09-28', T0);
  eq(Object.keys(s.runs.money), ['2026-10']);
});

test('ticking everything at once records no duration', () => {
  let s = toggleStep(state(), 'money', 'numbers', '2026-10-04', T0);
  s = toggleStep(s, 'money', 'wealth', '2026-10-04', T0 + 10000);
  eq(s.runs.money['2026-10'].done, true);
  eq(s.runs.money['2026-10'].minutes, undefined);
});

test('groceries: launch starts the clock, mark done stops it', () => {
  let s = startRitual(state(), 'groceries', '2026-10-04', T0);
  s = toggleRitualDone(s, 'groceries', '2026-10-04', T0 + 40 * MIN);
  eq(s.runs.groceries['2026-W40'].minutes, 40);
  s = toggleRitualDone(s, 'groceries', '2026-10-04', T0 + 41 * MIN);
  eq(s.runs.groceries['2026-W40'].done, false);
});

test('manual goal progress is clamped to 0–100', () => {
  const s = setGoalPct(state({ goals: [{ id: 'g', level: 'year', measure: { type: 'manual', pct: 10 } }] }), 'g', 140);
  eq(s.goals[0].measure.pct, 100);
});
