import { test, eq } from './harness.js';
import { moneyWindow, state, ticks } from './fixtures.js';
import { saveGoals } from '../src/core/actions.js';
import { goalsFor, measure, periodName } from '../src/core/goals.js';

const g = (level, period, m, id = `${level}-${period}`) => ({ id, level, period, title: id, measure: m });

test('goals for this period, else the latest earlier set carries over', () => {
  const goals = [g('week', '2026-W39', { type: 'manual', pct: 1 }), g('week', '2026-W38', { type: 'manual', pct: 1 })];
  eq(goalsFor(goals, 'week', '2026-10-01').carriedFrom, '2026-W39');
  eq(goalsFor(goals, 'week', '2026-10-01').goals.length, 1);
  eq(goalsFor(goals.concat(g('week', '2026-W40', { type: 'manual', pct: 1 })), 'week', '2026-10-01').carriedFrom, null);
  eq(goalsFor([], 'week', '2026-10-01'), { goals: [], carriedFrom: null });
});

test('habit-linked goals: week and month', () => {
  const s = state({ checks: ticks('mn', ['2026-09-28', '2026-09-29', '2026-10-01']) });
  eq(measure(g('week', '2026-W40', { type: 'habit', habitId: 'mn' }), s, '2026-10-01').label, '3/7');
  eq(measure(g('month', '2026-10', { type: 'habit', habitId: 'mn' }), s, '2026-10-01').label, '1/31');
  eq(measure(g('month', '2026-10', { type: 'habit', habitId: 'gym' }), s, '2026-10-01').label, '0/18');
});

test('year goal for a weekly habit waits for its first full week', () => {
  const s = state({ checks: ticks('gym', ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01']) });
  const goal = g('year', '2026', { type: 'habit', habitId: 'gym' });
  eq(measure(goal, s, '2026-10-01').label, '—');
  eq(measure(goal, s, '2026-10-06').label, '100%');
  eq(measure(goal, s, '2026-10-13').label, '50%');
});

test('ritual-linked week goal follows the checklist', () => {
  const s = state({ runs: { money: { '2026-10': { steps: { numbers: true } } } } });
  eq(measure(g('week', '2026-W40', { type: 'ritual', ritualId: 'money' }), s, '2026-10-01').label, '1/3');
  eq(measure(g('week', '2026-W40', { type: 'ritual', ritualId: 'money' }), state(), '2026-09-28').label, '0/3');
});

test('manual goals show their percentage', () => {
  eq(measure(g('year', '2026', { type: 'manual', pct: 35 }), state(), '2026-10-01'), { value: 0.35, label: '35%', manual: true });
});

test('an emptied period stays empty instead of carrying the previous goals over', () => {
  const goals = [g('week', '2026-W40', { type: 'manual', pct: 1 })];
  const s = saveGoals(state({ goals }), 'week', '2026-W41', []);
  eq(goalsFor(s.goals, 'week', '2026-10-06'), { goals: [], carriedFrom: null });
  eq(goalsFor(s.goals, 'week', '2026-10-13'), { goals: [], carriedFrom: null }, 'and the week after follows the empty one');
  eq(goalsFor(s.goals, 'week', '2026-10-01').goals.length, 1, 'week 40 keeps its own');
});

test('a year goal linked to a ritual counts only periods that came due', () => {
  const s = (runs) => state({ rituals: [moneyWindow], runs });
  const goal = g('year', '2026', { type: 'ritual', ritualId: 'money' });
  eq(measure(goal, s({}), '2026-09-29').label, '—', 'nothing due yet');
  const sep = { money: { '2026-09': { done: true } } };
  eq(measure(goal, s(sep), '2026-10-10').label, '100%', 'October isn’t due yet');
  eq(measure(goal, s(sep), '2026-11-20').label, '50%', 'October missed');
  eq(measure(goal, s({}), '2026-10-01').label, '0%', 'September is late');
});

test('period names', () => {
  eq([periodName('week', '2026-W41'), periodName('month', '2026-10'), periodName('year', '2026')], ['Week 41', 'October', '2026']);
});
