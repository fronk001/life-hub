// Habits: quotas, streaks and what is "in play" today. Pure functions over
// `checks`, the record of every tick: { '2026-09-28': { mn: true, gym: true } }.

import { addDays, dayName, diffDays, weekDays, weekStart, weekday, weekdayName } from './dates.js';

export const isDone = (checks, day, id) => !!(checks[day] && checks[day][id]);

// A habit's quota can change (the habit editor). The change counts from the
// Monday of the week it was made in; earlier weeks keep the quota they had,
// kept in `pastFreq`: [{ until: Monday the next quota began, freq }], oldest first.
export function freqOn(habit, day) {
  if (day) {
    const w = weekStart(day);
    const past = (habit.pastFreq || []).find((p) => w < p.until);
    if (past) return past.freq;
  }
  return habit.freq;
}

export const targetOf = (freq) => (freq.type === 'daily' ? 7 : freq.times);

// Without a day: the current quota. In the week a habit began, no more than
// the days it had: one added on a Friday can't owe 7 or 4 that week.
export function weeklyTarget(habit, day) {
  const target = targetOf(freqOn(habit, day));
  if (!day || !habit.createdDay || weekStart(day) >= habit.createdDay) return target;
  return Math.max(1, Math.min(target, 1 + diffDays(habit.createdDay, addDays(weekStart(day), 6))));
}

export const freqText = (freq) => (freq.type === 'daily' ? 'Daily' : `${freq.times}× per week`);

export const freqLabel = (habit) => freqText(habit.freq);

export function weekCount(checks, habit, day) {
  return weekDays(day).filter((d) => isDone(checks, d, habit.id)).length;
}

export const weekMet = (checks, habit, day) => weekCount(checks, habit, day) >= weeklyTarget(habit, day);

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

// The featured habit's streak: days in a row for a daily habit, weeks on
// quota in a row for a weekly one (a rest day mustn't break it).
export function habitStreak(checks, habit, today) {
  if (habit.freq.type === 'daily') return { ...streak(checks, habit.id, today), unit: 'day' };
  return { ...weekStreak(checks, habit, today), unit: 'week' };
}

// For a weekly habit: weeks in a row on quota. This week counts once it's
// met; until then the streak runs up to last week. Weeks before the habit
// existed end it.
export function weekStreak(checks, habit, today) {
  const first = habit.createdDay ? weekStart(habit.createdDay) : null;
  const thisWeek = weekStart(today);
  const met = (w) => weekMet(checks, habit, w);
  let w = met(thisWeek) ? thisWeek : addDays(thisWeek, -7);
  let current = 0;
  while ((!first || w >= first) && met(w)) {
    current += 1;
    w = addDays(w, -7);
  }
  const ticked = Object.keys(checks).filter((d) => d <= today && checks[d][habit.id]).sort();
  let longest = 0;
  let run = 0;
  for (w = weekStart(first || ticked[0] || today); w <= thisWeek; w = addDays(w, 7)) {
    run = met(w) ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  return { current, longest: Math.max(longest, current) };
}

// The n weeks before this one, oldest first. Weeks that ended before the habit
// existed are marked so they read as "no data", not as failures.
export function weekHistory(checks, habit, today, n = 4) {
  const out = [];
  for (let i = n; i >= 1; i -= 1) {
    const start = addDays(weekStart(today), -7 * i);
    const target = weeklyTarget(habit, start);
    const beforeStart = !!habit.createdDay && addDays(start, 6) < habit.createdDay;
    const count = weekCount(checks, habit, start);
    out.push({ start, count, target, met: count >= target, beforeStart });
  }
  return out;
}

// The weekdays a weekly habit is planned on (1 = Monday … 7 = Sunday), set in
// the weekly review. The plan stays until the next review changes it.
export const planned = (habit) => habit.plannedWeekdays || [];

// "Saturday" / "Mon, Tue, Thu, Sat"
export function planDays(habit) {
  const p = [...planned(habit)].sort();
  return p.length === 1 ? dayName(p[0]) : p.map((d) => dayName(d).slice(0, 3)).join(', ');
}

// "Saturday planned" / "Mon, Tue, Thu, Sat planned"
export const planLabel = (habit) => (planned(habit).length ? `${planDays(habit)} planned` : '');

// The line under a habit's name: its own words, or for a weekly habit with a
// plan, the quota and the planned days (which change from week to week).
export function habitSub(habit) {
  if (habit.freq.type === 'weekly' && planned(habit).length) return `${freqLabel(habit)} · ${planLabel(habit)}`;
  return habit.sub || freqLabel(habit);
}

// Whether a habit counts towards today's "x of y done". Daily habits always
// do. A weekly habit counts until this week's quota is met, and when it has
// planned days, only on those. Anything ticked today counts.
export function inPlayToday(checks, habit, today) {
  if (isDone(checks, today, habit.id)) return true;
  if (freqOn(habit, today).type === 'daily') return true;
  if (weekMet(checks, habit, today)) return false;
  return !planned(habit).length || planned(habit).includes(weekday(today));
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
  const last = freqOn(habit, today).type === 'weekly' ? lastDoneThisWeek(checks, habit.id, today) : null;
  if (last) return `${weekdayName(last)} was a session · ${freqLabel(habit)}`;
  return habitSub(habit);
}
