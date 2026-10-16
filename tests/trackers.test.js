// Goals counted by hand, habit goals with their own target, new habits and
// changed quotas (16 Oct 2026, from Fred's first weeks of use).
import { test, eq } from './harness.js';
import { byId, habits, state, ticks } from './fixtures.js';
import { addHabit, bumpGoal, saveGoals, setGoalCount, setGoalPct, setHabitFreqs } from '../src/core/actions.js';
import { goalsFor, measure } from '../src/core/goals.js';
import { freqOn, habitSub, weekHistory, weekStreak, weeklyTarget } from '../src/core/habits.js';
import { weekMisses } from '../src/core/penalty.js';

// Week 40 = 28 Sep–4 Oct, 41 = 5–11 Oct, 42 = 12–18 Oct.
const goal = (id, level, period, m) => ({ id, level, period, title: id, measure: m });
const count = (target, n = 0) => ({ type: 'count', target, n });
const days = (from, n) => Array.from({ length: n }, (_, i) => { const d = new Date(`${from}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + i); return d.toISOString().slice(0, 10); });

test('a counted goal: +1 per tap, never below 0, each day logged once', () => {
  let s = state({ goals: [goal('run', 'week', '2026-W42', count(3))] });
  eq(measure(s.goals[0], s, '2026-10-13').label, '0/3');
  s = bumpGoal(s, 'run', 1, '2026-10-13');
  s = bumpGoal(s, 'run', 1, '2026-10-14');
  s = bumpGoal(s, 'run', 1, '2026-10-14');
  eq(measure(s.goals[0], s, '2026-10-14'), { value: 1, label: '3/3', count: true, n: 3, target: 3 });
  eq(s.goals[0].log, [{ day: '2026-10-13', v: 1 }, { day: '2026-10-14', v: 3 }]);
  s = setGoalCount(s, 'run', 0, '2026-10-14');
  s = bumpGoal(s, 'run', -1, '2026-10-14');
  eq(s.goals[0].measure.n, 0);
});

test('a carried-over goal is changed in this week, not in last week', () => {
  const s0 = state({ goals: [goal('run', 'week', '2026-W41', count(3, 2)), goal('pct', 'week', '2026-W41', { type: 'manual', pct: 40 })] });
  const shown = goalsFor(s0.goals, 'week', '2026-10-13');
  eq(shown.carriedFrom, '2026-W41');
  eq(measure(shown.goals[0], s0, '2026-10-13').label, '0/3', 'a count starts again in a new week');
  const s = bumpGoal(s0, 'run', 1, '2026-10-13');
  eq(s.goals.find((g) => g.id === 'run').measure.n, 2, 'week 41 keeps its count');
  const now = goalsFor(s.goals, 'week', '2026-10-13');
  eq(now.carriedFrom, null);
  eq(now.goals.map((g) => [g.id, measure(g, s, '2026-10-13').label]), [['run~2026-W42', '1/3'], ['pct~2026-W42', '40%']]);
  const t = setGoalPct(s0, 'pct', 70, '2026-10-13');
  eq(t.goals.find((g) => g.id === 'pct').measure.pct, 40, 'week 41 keeps its percentage');
  eq(t.goals.find((g) => g.id === 'pct~2026-W42').measure.pct, 70);
  eq(weekMisses(s, '2026-10-05').missed, ['run', 'pct'], 'last week is billed on its own values');
});

test('the editor keeps a goal’s count and log, and logs a changed percentage', () => {
  let s = state({ goals: [goal('run', 'week', '2026-W42', count(3, 2)), goal('pct', 'year', '2026', { type: 'manual', pct: 35 })] });
  s.goals[0].log = [{ day: '2026-10-13', v: 2 }];
  s = saveGoals(s, 'week', '2026-W42', [{ id: 'run', title: 'Run', measure: { type: 'count', target: 4 } }], '2026-10-14');
  eq(s.goals.find((g) => g.id === 'run').measure, { type: 'count', target: 4, n: 2 });
  eq(s.goals.find((g) => g.id === 'run').log, [{ day: '2026-10-13', v: 2 }]);
  s = saveGoals(s, 'year', '2026', [{ id: 'pct', title: 'Talk', measure: { type: 'manual', pct: 40 } }], '2026-10-14');
  eq(s.goals.find((g) => g.id === 'pct').log, [{ day: '2026-10-14', v: 40 }]);
});

test('a habit goal can set its own target for the week, month or year', () => {
  const s = state({ checks: ticks('gym', ['2026-10-12', '2026-10-13', '2026-10-15', '2026-10-01']) });
  const g = (level, period, target) => goal('g', level, period, { type: 'habit', habitId: 'gym', target });
  eq(measure(g('week', '2026-W42', 3), s, '2026-10-16').label, '3/3');
  eq(measure(g('week', '2026-W42', undefined), s, '2026-10-16').label, '3/4', 'no target: the habit’s quota');
  eq(measure(g('month', '2026-10', 12), s, '2026-10-16').label, '4/12');
  eq(measure(g('year', '2026', 150), s, '2026-10-16').label, '4/150');
});

test('a new habit counts from the day it was added', () => {
  let s = addHabit(state(), { id: 'swim', name: ' Swimming ' }, { type: 'weekly', times: 2 }, '2026-10-14');
  const swim = byId(s.habits, 'swim');
  eq([swim.name, swim.freq, swim.createdDay], ['Swimming', { type: 'weekly', times: 2 }, '2026-10-14']);
  eq(addHabit(s, { id: 'swim', name: 'Again' }, null, '2026-10-14').habits.length, s.habits.length, 'ids are unique');
  eq(addHabit(s, { id: 'x', name: '  ' }, null, '2026-10-14').habits.length, s.habits.length, 'a name is needed');
  s = addHabit(s, { id: 'walk', name: 'Walk' }, { type: 'weekly', times: 99 }, '2026-10-14');
  eq(byId(s.habits, 'walk').freq.times, 6, 'at most 6× a week; 7 is daily');
});

test('a changed quota counts from this week’s Monday; earlier weeks keep theirs', () => {
  const mn = { ...byId(habits, 'mn'), sub: 'Daily · no exceptions', featured: { title: 'Mongolian', note: 'Goal: every day of 2026' } };
  let s = state({ habits: [mn] });
  s = setHabitFreqs(s, { mn: { type: 'weekly', times: 5 } }, '2026-10-14');
  let h = byId(s.habits, 'mn');
  eq(h.pastFreq, [{ until: '2026-10-12', freq: { type: 'daily' } }]);
  eq([weeklyTarget(h, '2026-10-07'), weeklyTarget(h, '2026-10-12'), weeklyTarget(h)], [7, 5, 5]);
  eq([h.sub, h.featured.note, habitSub(h)], [undefined, undefined, '5× per week'], 'words stating the old quota go');
  s = setHabitFreqs(s, { mn: { type: 'weekly', times: 4 } }, '2026-10-16');
  h = byId(s.habits, 'mn');
  eq([h.pastFreq.length, weeklyTarget(h, '2026-10-12')], [1, 4], 'a second change in the same week replaces the first');
  s = setHabitFreqs(s, { mn: { type: 'daily' } }, '2026-10-21');
  h = byId(s.habits, 'mn');
  eq([freqOn(h, '2026-10-07').type, weeklyTarget(h, '2026-10-14'), weeklyTarget(h, '2026-10-21')], ['daily', 4, 7]);
});

test('a habit changed in the week it began has no earlier quota to keep', () => {
  const s = setHabitFreqs(addHabit(state(), { id: 'swim', name: 'Swim' }, { type: 'weekly', times: 2 }, '2026-10-13'), { swim: { type: 'weekly', times: 3 } }, '2026-10-15');
  eq(byId(s.habits, 'swim').pastFreq, undefined);
});

test('history, the bill and year goals use each week’s own quota', () => {
  const s0 = state({
    checks: ticks('mn', [...days('2026-09-28', 7), ...days('2026-10-05', 5), ...days('2026-10-12', 5)]),
    goals: [goal('w41', 'week', '2026-W41', { type: 'habit', habitId: 'mn' }), goal('w42', 'week', '2026-W42', { type: 'habit', habitId: 'mn' })],
  });
  const s = setHabitFreqs(s0, { mn: { type: 'weekly', times: 5 } }, '2026-10-14');
  const h = byId(s.habits, 'mn');
  eq(weekHistory(s.checks, h, '2026-10-19', 2).map((w) => [w.count, w.target, w.met]), [[5, 7, false], [5, 5, true]]);
  eq(weekMisses(s, '2026-10-05').missed, ['w41'], 'week 41 was still a daily week');
  eq(weekMisses(s, '2026-10-12').missed, [], 'week 42 is on the new quota');
  const year = goal('y', 'year', '2026', { type: 'habit', habitId: 'mn' });
  eq(measure(year, s, '2026-10-19').label, '87%', '12 of 14 daily days, then 1 of 1 full weeks on 5×: 13/15');
  eq(measure(goal('m', 'month', '2026-10', { type: 'habit', habitId: 'mn' }), s, '2026-10-16').label, '14/25', '4 + 7 daily days, then 20 days × 5/7');
});

test('a weekly habit’s streak counts weeks on quota', () => {
  const gym = byId(habits, 'gym');
  const c = ticks('gym', [...days('2026-09-28', 4), ...days('2026-10-05', 4), ...days('2026-10-12', 2)]);
  eq(weekStreak(c, gym, '2026-10-14'), { current: 2, longest: 2 }, 'this week isn’t met yet: up to last week');
  ticks('gym', ['2026-10-14', '2026-10-15'], c);
  eq(weekStreak(c, gym, '2026-10-15'), { current: 3, longest: 3 });
  eq(weekStreak(c, gym, '2026-10-26'), { current: 0, longest: 3 });
});

test('in the week a habit began, its target is no more than the days it had', () => {
  const s = addHabit(state(), { id: 'swim', name: 'Swim' }, { type: 'daily' }, '2026-10-16');
  const swim = byId(s.habits, 'swim');
  eq([weeklyTarget(swim, '2026-10-16'), weeklyTarget(swim, '2026-10-19')], [3, 7]);
  const t = addHabit(state(), { id: 'gym2', name: 'Gym' }, { type: 'weekly', times: 2 }, '2026-10-18');
  eq(weeklyTarget(byId(t.habits, 'gym2'), '2026-10-18'), 1);
  eq(measure(goal('w', 'week', '2026-W42', { type: 'habit', habitId: 'swim' }), s, '2026-10-16').label, '0/3');
});
