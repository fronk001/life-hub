// Goals at week, month and year level. A goal is either measured by hand
// (a percentage) or linked to a habit or ritual, in which case its progress is
// calculated from real ticks and never typed in.

import { addDays, daysInMonth, diffDays, monthKey, monthName, weekKey, weekStart, yearKey } from './dates.js';
import { isDone, weekCount, weekMet, weeklyTarget } from './habits.js';
import { activeRun, dueDay, owed, periodKey, progress } from './rituals.js';

export const periodOf = (level, day) => ({ week: weekKey, month: monthKey, year: yearKey }[level](day));

// "Week 41" · "October" · "2026"
export const periodName = (level, period) => ({
  week: (p) => `Week ${Number(p.slice(6))}`,
  month: (p) => monthName(p),
  year: (p) => p,
}[level](period));

// Goals for the period containing `day`. When none are set yet, the most
// recent earlier set carries over, so a card is never empty on the 1st.
// A period emptied on purpose keeps one archived marker (saveGoals in
// actions.js): it counts as set, so it stays empty instead of carrying over.
export function goalsFor(goals, level, day) {
  const current = periodOf(level, day);
  const mine = goals.filter((g) => g.level === level);
  const active = (p) => mine.filter((g) => g.period === p && !g.archived);
  if (mine.some((g) => g.period === current)) return { goals: active(current), carriedFrom: null };
  const earlier = mine.map((g) => g.period).filter((p) => p < current).sort();
  const from = earlier[earlier.length - 1];
  if (!from || !active(from).length) return { goals: [], carriedFrom: null };
  return { goals: active(from), carriedFrom: from };
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
  // Year: of this year's periods that came due (and were owed), the share
  // done. A period whose due day is still ahead only counts once it's done.
  const mine = runs[ritual.id] || {};
  const year = yearKey(today);
  const periods = new Map();
  for (let d = `${year}-01-01`; d <= today; d = addDays(d, 1)) if (!periods.has(periodKey(ritual, d))) periods.set(periodKey(ritual, d), d);
  let due = 0;
  let done = 0;
  for (const [key, d] of periods) {
    const when = dueDay(ritual, d);
    const ran = !!(mine[key] && mine[key].done);
    if (yearKey(when) !== year || !owed(ritual, when) || (when >= today && !ran)) continue;
    due += 1;
    if (ran) done += 1;
  }
  if (!due) return { value: 0, label: '—', note: 'counts from its first due day' };
  return pct(done, due);
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
