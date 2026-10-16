// Habits ticked by another app. The Mongolian app (../mongolian, same
// Firebase account) keeps one history row per calendar day it was studied,
// with the times the day's first and last session finished (firstAt, lastAt,
// ms). Each finished session ticks the linked habit on Life Hub's own day,
// which runs until 04:00: a lesson at 00:30 counts for the evening before.
//
// A habit is linked by `link: { app: 'mongolian', since: day }` (core/migrate.js).
// Days before `since` are left as they are. A day with a real session is
// always done: unticking it by hand is refused (actions.js toggleHabit).

import { logicalDay } from './dates.js';

// The Life Hub days the app was studied on: from each row the day of its
// first and of its last session (the same day unless a session fell between
// midnight and 04:00). A row written before the app kept times counts for
// its calendar date.
export function sessionDays(rows) {
  const days = new Set();
  for (const [date, row] of Object.entries(rows || {})) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !row) continue;
    const times = [row.firstAt, row.lastAt].filter(Number.isFinite);
    if (!times.length) days.add(date);
    for (const t of times) days.add(logicalDay(new Date(t)));
  }
  return days;
}

// The days `habit` is ticked by its app: studied, from its `since` on.
export function linkedDays(habit, rows) {
  if (!habit || !habit.link) return new Set();
  const since = habit.link.since || '';
  return new Set([...sessionDays(rows)].filter((d) => d >= since));
}

// The habits linked to `app`.
export const linkedTo = (state, app) => ((state && state.habits) || []).filter((h) => !h.archived && h.link && h.link.app === app);
