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

// `on`: true or false to set the step, undefined to flip it.
export function setStep(state, ritualId, stepId, on, today, now) {
  const s = clone(state);
  const ritual = find(s, ritualId);
  const run = runOf(s, ritual, today);
  if (!run.startedAt) run.startedAt = now;
  if (on === undefined ? !run.steps[stepId] : on) run.steps[stepId] = true;
  else delete run.steps[stepId];
  settle(ritual, run, today, now);
  return s;
}

export const toggleStep = (state, ritualId, stepId, today, now) => setStep(state, ritualId, stepId, undefined, today, now);

// For rituals without steps: done / not done for this period.
export function toggleRitualDone(state, ritualId, today, now) {
  const s = clone(state);
  const ritual = find(s, ritualId);
  const run = runOf(s, ritual, today);
  if (run.done) unfinish(run);
  else finish(run, today, now);
  return s;
}

const clampPct = (pct) => Math.max(0, Math.min(100, Math.round(Number(pct) || 0)));

// Replaces one period's goals with `goals` ([{ id, title, measure }], in
// order; the caller picks the ids, new ones included). Untitled rows are
// dropped. An emptied period keeps one archived marker, so it stays empty
// rather than showing the previous period's goals again (goalsFor).
export function saveGoals(state, level, period, goals) {
  const s = clone(state);
  const kept = goals.filter((g) => String(g.title || '').trim()).map((g) => {
    const m = g.measure || { type: 'manual', pct: 0 };
    const measure = m.type === 'manual' ? { type: 'manual', pct: clampPct(m.pct) } : m;
    return { id: g.id, level, period, title: g.title.trim(), measure };
  });
  const others = s.goals.filter((g) => !(g.level === level && g.period === period));
  const marker = { id: `none-${level}-${period}`, level, period, title: '', archived: true, measure: { type: 'manual', pct: 0 } };
  s.goals = [...others, ...(kept.length ? kept : [marker])];
  return s;
}

// The weekly review's plan: { habitId: [weekdays] }, 1 = Monday … 7 = Sunday.
// No days means "any day".
export function setPlannedDays(state, plan) {
  const s = clone(state);
  for (const h of s.habits) {
    if (!(h.id in plan)) continue;
    const days = [...new Set(plan[h.id])].filter((d) => d >= 1 && d <= 7).sort();
    if (days.length) h.plannedWeekdays = days;
    else delete h.plannedWeekdays;
  }
  return s;
}

export function setGoalPct(state, goalId, pct) {
  const s = clone(state);
  const g = s.goals.find((x) => x.id === goalId);
  if (g) g.measure = { type: 'manual', pct: clampPct(pct) };
  return s;
}
