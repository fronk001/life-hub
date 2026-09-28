// Goals at week, month and year level. A goal is either measured by hand
// (a percentage) or linked to a habit or ritual, in which case its progress is
// calculated from real ticks and never typed in.

import { addDays, daysInMonth, diffDays, monthKey, weekKey, weekStart, yearKey } from './dates.js';
import { isDone, weekCount, weekMet, weeklyTarget } from './habits.js';
import { activeRun, periodKey, progress } from './rituals.js';

export const periodOf = (level, day) => ({ week: weekKey, month: monthKey, year: yearKey }[level](day));

// Goals for the current period. When none are set yet, the most recent
// earlier set carries over, so a card is never empty on the 1st.
export function goalsFor(goals, level, today) {
  const current = periodOf(level, today);
  const mine = goals.filter((g) => g.level === level && !g.archived);
  const now = mine.filter((g) => g.period === current);
  if (now.length || !mine.length) return { goals: now, carriedFrom: null };
  const earlier = mine.map((g) => g.period).filter((p) => p < current).sort();
  if (!earlier.length) return { goals: [], carriedFrom: null };
  const from = earlier[earlier.length - 1];
  return { goals: mine.filter((g) => g.period === from), carriedFrom: from };
}

const frac = (a, b) => ({ value: b ? Math.min(a / b, 1) : 0, label: `${a}/${b}` });
const pct = (a, b) => {
  const v = b ? Math.min(a / b, 1) : 0;
  return { value: v, label: `${Math.round(v * 100)}%` };
};

function habitMeasure(level, habit, checks, today) {
  if (level === 'week') return frac(weekCount(checks, habit, today), weeklyTarget(habit));

  if (level === 'month') {
    const m = monthKey(today);
    const done = Object.keys(checks).filter((d) => monthKey(d) === m && isDone(checks, d, habit.id)).length;
    const days = daysInMonth(m);
    const target = habit.freq.type === 'daily' ? days : Math.round((habit.freq.times * days) / 7);
    return frac(done, target);
  }

  // year: share of days (daily) or of completed weeks (weekly) since the habit began
  const yearStart = `${yearKey(today)}-01-01`;
  const from = habit.createdDay && habit.createdDay > yearStart ? habit.createdDay : yearStart;
  if (habit.freq.type === 'daily') {
    let done = 0;
    for (let d = from; d <= today; d = addDays(d, 1)) if (isDone(checks, d, habit.id)) done += 1;
    return pct(done, diffDays(from, today) + 1);
  }
  // Completed weeks only, starting with the first full week: a week the habit
  // joined halfway through would count as a miss it never had a chance at.
  let weeks = 0;
  let met = 0;
  let w = weekStart(from);
  if (w < from) w = addDays(w, 7);
  for (; w < weekStart(today); w = addDays(w, 7)) {
    weeks += 1;
    if (weekMet(checks, habit, w)) met += 1;
  }
  if (!weeks) return { value: 0, label: '—', note: 'counts from your first full week' };
  return pct(met, weeks);
}

function ritualMeasure(level, ritual, runs, today) {
  if (level !== 'year') {
    const run = activeRun(runs, ritual, today);
    const p = progress(ritual, run);
    if (!p.total) return frac(run && run.done ? 1 : 0, 1);
    // A finished run reads as full even if an optional step was skipped.
    return run && run.done ? frac(p.total, p.total) : frac(p.done, p.total);
  }
  const mine = runs[ritual.id] || {};
  const done = Object.entries(mine).filter(([k, r]) => r.done && k.startsWith(yearKey(today))).length;
  const start = ritual.createdDay && ritual.createdDay.startsWith(yearKey(today)) ? ritual.createdDay : `${yearKey(today)}-01-01`;
  const keys = new Set();
  for (let d = start; d <= today; d = addDays(d, 1)) keys.add(periodKey(ritual, d));
  return pct(done, keys.size);
}

export function measure(goal, state, today) {
  const m = goal.measure || { type: 'manual', pct: 0 };
  if (m.type === 'habit') {
    const habit = state.habits.find((h) => h.id === m.habitId);
    if (habit) return habitMeasure(goal.level, habit, state.checks, today);
  }
  if (m.type === 'ritual') {
    const ritual = state.rituals.find((r) => r.id === m.ritualId);
    if (ritual) return ritualMeasure(goal.level, ritual, state.runs, today);
  }
  const p = Math.max(0, Math.min(100, Number(m.pct) || 0));
  return { value: p / 100, label: `${p}%`, manual: true };
}
