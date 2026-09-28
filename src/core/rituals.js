// Rituals: recurring sessions with a due day, optional checklist and history.
// Pure functions over `runs`: { ritualId: { periodKey: run } } where a run is
// { startedAt, steps: { stepId: true }, done, doneDay, doneAt, minutes }.

import {
  addDays, addMonths, diffDays, firstWeekendSunday, monthKey, shortLabel, weekKey, weekStart,
  weekdayName,
} from './dates.js';

const isMonthly = (r) => r.schedule.type === 'monthly';

export const periodKey = (r, day) => (isMonthly(r) ? monthKey(day) : weekKey(day));

export function dueDay(r, day) {
  if (isMonthly(r)) return firstWeekendSunday(monthKey(day));
  return addDays(weekStart(day), r.schedule.weekday - 1);
}

// A day inside the period `back` periods before the one containing `day`.
function periodDay(r, day, back) {
  if (isMonthly(r)) return `${addMonths(monthKey(day), -back)}-01`;
  return addDays(weekStart(day), -7 * back);
}

export const runFor = (runs, r, day) => (runs[r.id] || {})[periodKey(r, day)] || null;

// The day whose period "counts" right now. Normally today; but a period whose
// due day passed before the ritual existed was never owed — a money review
// added on 28 September is due in October, not overdue since 6 September.
export function activeDay(r, runs, today) {
  if (!r.createdDay || dueDay(r, today) >= r.createdDay) return today;
  const run = runFor(runs, r, today);
  if (run && (run.done || run.startedAt)) return today;
  return periodDay(r, today, -1);
}

export const activeRun = (runs, r, today) => runFor(runs, r, activeDay(r, runs, today));

export const required = (r) => (r.steps || []).filter((s) => !s.optional);

export function isComplete(r, run) {
  if (!run) return false;
  if (!(r.steps || []).length) return !!run.done;
  return required(r).every((s) => run.steps && run.steps[s.id]);
}

export function progress(r, run) {
  const steps = r.steps || [];
  const ticked = steps.filter((s) => run && run.steps && run.steps[s.id]).length;
  return { done: ticked, total: steps.length };
}

// Minutes of work still ahead, from the ritual's typical length, to the 5.
export function minutesLeft(r, run) {
  if (!r.duration) return null;
  const { done, total } = progress(r, run);
  if (!total) return r.duration;
  return Math.max(5, Math.round((r.duration * (1 - done / total)) / 5) * 5);
}

// The pill in the top-right of a ritual card.
//   done      – this period's run is complete
//   overdue   – due day has passed and it isn't done
//   due-today – due today
//   due-soon  – a monthly-or-longer ritual due within 7 days
//   on-track  – anything else (weekly rituals sit here until their day)
export function status(r, runs, today) {
  const day = activeDay(r, runs, today);
  const run = runFor(runs, r, day);
  const due = dueDay(r, day);
  if (run && run.done) {
    return { kind: 'done', due, label: run.minutes ? `Done · ${run.minutes} min` : 'Done' };
  }
  const days = diffDays(today, due);
  if (days < 0) return { kind: 'overdue', due, label: `Overdue since ${shortLabel(due)}` };
  if (days === 0) return { kind: 'due-today', due, label: 'Due today' };
  if (isMonthly(r) && days <= 7) return { kind: 'due-soon', due, label: `Due ${shortLabel(due)}` };
  if (r.duration && !(run && run.startedAt)) return { kind: 'on-track', due, label: `${r.duration} min`, neutral: true };
  return { kind: 'on-track', due, label: 'On track' };
}

// "due Sunday" / "due today" / "overdue" for the phone banner.
export function dueWords(st) {
  if (st.kind === 'overdue') return 'overdue';
  if (st.kind === 'due-today') return 'due today';
  return `due ${weekdayName(st.due)}`;
}

export function history(r, runs, today, n = 8) {
  const mine = runs[r.id] || {};
  const out = [];
  for (let back = n - 1; back >= 0; back -= 1) {
    const day = periodDay(r, today, back);
    const key = periodKey(r, day);
    const run = mine[key];
    const lastDay = isMonthly(r) ? addDays(`${addMonths(monthKey(day), 1)}-01`, -1) : addDays(weekStart(day), 6);
    out.push({
      key,
      done: !!(run && run.done),
      current: back === 0,
      beforeStart: !!r.createdDay && lastDay < r.createdDay,
    });
  }
  return out;
}

export function lastRunDay(r, runs) {
  const days = Object.values(runs[r.id] || {}).filter((x) => x.done && x.doneDay).map((x) => x.doneDay);
  return days.length ? days.sort()[days.length - 1] : null;
}

export function nextDue(r, runs, today) {
  const day = activeDay(r, runs, today);
  const run = runFor(runs, r, day);
  if (run && run.done) return dueDay(r, periodDay(r, day, -1));
  return dueDay(r, day);
}

// Rituals the phone should nag about: started but unfinished, overdue, due
// today, or — for monthly ones — due within three days. A weekly ritual only
// shows on its own day; otherwise every Thursday would carry three banners.
export function needsAttention(r, runs, today) {
  const st = status(r, runs, today);
  if (st.kind === 'done') return false;
  const run = activeRun(runs, r, today);
  if (run && run.startedAt) return true;
  if (st.kind === 'overdue' || st.kind === 'due-today') return true;
  return isMonthly(r) && diffDays(today, st.due) <= 3;
}
