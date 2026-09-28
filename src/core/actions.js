// Every change the UI can make, as pure functions: (state, …args) -> new state.
// Nothing here touches storage or the clock; callers pass `today` and `now`.

import { activeDay, isComplete, periodKey } from './rituals.js';

const clone = (x) => JSON.parse(JSON.stringify(x));

// A run's duration is only worth showing when it plausibly measures the work:
// ticking everything in ten seconds after the fact, or leaving a run open
// overnight, says nothing about how long the session took.
const MIN_MINUTES = 2;
const MAX_MINUTES = 8 * 60;

export function toggleHabit(state, habitId, day) {
  const s = clone(state);
  const d = (s.checks[day] = s.checks[day] || {});
  if (d[habitId]) delete d[habitId];
  else d[habitId] = true;
  if (!Object.keys(d).length) delete s.checks[day];
  return s;
}

function runOf(s, ritual, today) {
  const key = periodKey(ritual, activeDay(ritual, s.runs, today));
  const mine = (s.runs[ritual.id] = s.runs[ritual.id] || {});
  return (mine[key] = mine[key] || { steps: {} });
}

function finish(run, today, now) {
  run.done = true;
  run.doneDay = today;
  run.doneAt = now;
  const minutes = run.startedAt ? Math.round((now - run.startedAt) / 60000) : 0;
  if (minutes >= MIN_MINUTES && minutes <= MAX_MINUTES) run.minutes = minutes;
  else delete run.minutes;
}

function unfinish(run) {
  run.done = false;
  delete run.doneDay;
  delete run.doneAt;
  delete run.minutes;
}

// Optional steps never hold a run open, and un-ticking a required step
// reopens a finished one.
function settle(ritual, run, today, now) {
  const complete = isComplete(ritual, run);
  if (complete && !run.done) finish(run, today, now);
  else if (!complete && run.done) unfinish(run);
}

const find = (s, ritualId) => s.rituals.find((r) => r.id === ritualId);

export function startRitual(state, ritualId, today, now) {
  const s = clone(state);
  const run = runOf(s, find(s, ritualId), today);
  if (!run.startedAt) run.startedAt = now;
  return s;
}

export function toggleStep(state, ritualId, stepId, today, now) {
  const s = clone(state);
  const ritual = find(s, ritualId);
  const run = runOf(s, ritual, today);
  if (!run.startedAt) run.startedAt = now;
  if (run.steps[stepId]) delete run.steps[stepId];
  else run.steps[stepId] = true;
  settle(ritual, run, today, now);
  return s;
}

// For rituals without steps: done / not done for this period.
export function toggleRitualDone(state, ritualId, today, now) {
  const s = clone(state);
  const ritual = find(s, ritualId);
  const run = runOf(s, ritual, today);
  if (run.done) unfinish(run);
  else finish(run, today, now);
  return s;
}

export function setGoalPct(state, goalId, pct) {
  const s = clone(state);
  const g = s.goals.find((x) => x.id === goalId);
  if (g) g.measure = { type: 'manual', pct: Math.max(0, Math.min(100, Math.round(pct))) };
  return s;
}
