// Habits: quotas, streaks and what is "in play" today. Pure functions over
// `checks`, the record of every tick: { '2026-09-28': { mn: true, gym: true } }.

import { addDays, diffDays, weekDays, weekStart, weekday, weekdayName } from './dates.js';

export const isDone = (checks, day, id) => !!(checks[day] && checks[day][id]);

export const weeklyTarget = (habit) => (habit.freq.type === 'daily' ? 7 : habit.freq.times);

export function freqLabel(habit) {
  return habit.freq.type === 'daily' ? 'Daily' : `${habit.freq.times}× per week`;
}

export function weekCount(checks, habit, day) {
  return weekDays(day).filter((d) => isDone(checks, d, habit.id)).length;
}

export const weekMet = (checks, habit, day) => weekCount(checks, habit, day) >= weeklyTarget(habit);

// Consecutive done days. The current streak survives until the day is over:
// if today isn't ticked yet, it counts back from yesterday.
export function streak(checks, id, today) {
  let start = isDone(checks, today, id) ? today : addDays(today, -1);
  let current = 0;
  while (isDone(checks, start, id)) {
    current += 1;
    start = addDays(start, -1);
  }

  const days = Object.keys(checks).filter((d) => d <= today && checks[d][id]).sort();
  let longest = 0;
  let run = 0;
  let prev = null;
  for (const d of days) {
    run = prev && diffDays(prev, d) === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = d;
  }
  return { current, longest: Math.max(longest, current) };
}

// The n weeks before this one, oldest first. Weeks that ended before the habit
// existed are marked so they read as "no data", not as failures.
export function weekHistory(checks, habit, today, n = 4) {
  const target = weeklyTarget(habit);
  const out = [];
  for (let i = n; i >= 1; i -= 1) {
    const start = addDays(weekStart(today), -7 * i);
    const beforeStart = !!habit.createdDay && addDays(start, 6) < habit.createdDay;
    const count = weekCount(checks, habit, start);
    out.push({ start, count, target, met: count >= target, beforeStart });
  }
  return out;
}

const planned = (habit) => habit.plannedWeekdays || [];

// Whether a habit counts towards today's "x of y done". Daily habits always
// do. A weekly habit with planned days only counts on those days; one without
// counts until this week's quota is met. Anything ticked today counts.
export function inPlayToday(checks, habit, today) {
  if (isDone(checks, today, habit.id)) return true;
  if (habit.freq.type === 'daily') return true;
  if (planned(habit).length) return planned(habit).includes(weekday(today));
  return !weekMet(checks, habit, today);
}

export function todaySummary(checks, habits, today) {
  const live = habits.filter((h) => inPlayToday(checks, h, today));
  return { done: live.filter((h) => isDone(checks, today, h.id)).length, total: live.length };
}

// Most recent done day in this week, before today.
export function lastDoneThisWeek(checks, id, today) {
  const days = weekDays(today).filter((d) => d < today && isDone(checks, d, id));
  return days.length ? days[days.length - 1] : null;
}

// The phone's one-line hint under a habit's name.
export function phoneHint(checks, habit, today) {
  const p = planned(habit);
  if (p.length && !p.includes(weekday(today)) && !isDone(checks, today, habit.id)) {
    const next = [1, 2, 3, 4, 5, 6, 7].map((i) => addDays(today, i)).find((d) => p.includes(weekday(d)));
    return `Planned for ${weekdayName(next)}`;
  }
  const last = habit.freq.type === 'weekly' ? lastDoneThisWeek(checks, habit.id, today) : null;
  if (last) return `${weekdayName(last)} was a session · ${freqLabel(habit)}`;
  return habit.sub || freqLabel(habit);
}
