import { test, eq } from './harness.js';
import { state, MIN } from './fixtures.js';
import {
  saveGoals, setGoalPct, setPlannedDays, setStep, startRitual, toggleHabit, toggleRitualDone, toggleStep,
} from '../src/core/actions.js';

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

test('saving a period’s goals replaces that period only, in the order given', () => {
  const goals = [
    { id: 'a', level: 'week', period: '2026-W40', title: 'Old', measure: { type: 'manual', pct: 5 } },
    { id: 'b', level: 'month', period: '2026-10', title: 'Month', measure: { type: 'manual', pct: 5 } },
  ];
  const s = saveGoals(state({ goals }), 'week', '2026-W40', [
    { id: 'c', title: '  Gym 4 times ', measure: { type: 'habit', habitId: 'gym' } },
    { id: 'd', title: '', measure: { type: 'manual', pct: 10 } },
    { id: 'e', title: 'Vision board', measure: { type: 'manual', pct: 140 } },
  ]);
  eq(s.goals.map((x) => x.id), ['b', 'c', 'e'], 'the untitled row is dropped');
  eq(s.goals[1], { id: 'c', level: 'week', period: '2026-W40', title: 'Gym 4 times', measure: { type: 'habit', habitId: 'gym' } });
  eq(s.goals[2].measure, { type: 'manual', pct: 100 });
  eq(saveGoals(s, 'week', '2026-W40', []).goals.filter((x) => x.level === 'week').map((x) => x.archived), [true], 'emptied: one marker');
});

test('the plan of days: sorted, no doubles, and no days means any day', () => {
  let s = setPlannedDays(state(), { gym: [6, 1, 4, 1, 2] });
  eq(s.habits.find((h) => h.id === 'gym').plannedWeekdays, [1, 2, 4, 6]);
  eq(s.habits.find((h) => h.id === 'ride').plannedWeekdays, [6], 'a habit not in the plan is left alone');
  s = setPlannedDays(s, { ride: [] });
  eq('plannedWeekdays' in s.habits.find((h) => h.id === 'ride'), false);
});

test('a step can be set on purpose, not only flipped', () => {
  let s = setStep(state(), 'review', 'a', true, '2026-10-04', T0);
  s = setStep(s, 'review', 'a', true, '2026-10-04', T0 + MIN);
  eq(s.runs.review['2026-W40'].steps, { a: true }, 'ticking a ticked step keeps it ticked');
  s = setStep(s, 'review', 'b', true, '2026-10-04', T0 + 20 * MIN);
  eq([s.runs.review['2026-W40'].done, s.runs.review['2026-W40'].minutes], [true, 20]);
  s = setStep(s, 'review', 'a', false, '2026-10-04', T0 + 21 * MIN);
  eq(s.runs.review['2026-W40'].done, false);
});
