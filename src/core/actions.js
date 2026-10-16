// Every change the UI can make, as pure functions: (state, …args) -> new state.
// Nothing here touches storage or the clock; callers pass `today` and `now`.

import { weekStart } from './dates.js';
import { periodOf } from './goals.js';
import { activeDay, isComplete, periodKey } from './rituals.js';

const clone = (x) => JSON.parse(JSON.stringify(x));

// A run's duration is only worth showing when it plausibly measures the work:
// ticking everything in ten seconds after the fact, or leaving a run open
// overnight, says nothing about how long the session took.
const MIN_MINUTES = 2;
const MAX_MINUTES = 8 * 60;

// `studied`: the day has a real session in the habit's linked app
// (core/links.js), so it stays done.
export function toggleHabit(state, habitId, day, studied = false) {
  if (studied && state.checks[day] && state.checks[day][habitId]) return state;
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
const whole = (n, min = 0) => Math.max(min, Math.round(Number(n) || 0));

// A goal kept by hand remembers each new value: log = [{ day, v }], the
// percentage or the count, newest last. One entry per day (the last value
// of the day wins), at most LOG_MAX.
const LOG_MAX = 60;
function logValue(g, v, day) {
  if (!day) return;
  const log = (g.log || []).filter((e) => e.day !== day);
  const prev = log.length ? log[log.length - 1].v : null;
  if (prev !== v || !log.length) log.push({ day, v });
  g.log = log.slice(-LOG_MAX);
}

// The measure as saved: only the fields its type uses, numbers in range.
function cleanMeasure(m, before) {
  if (!m || m.type === 'manual' || !m.type) return { type: 'manual', pct: clampPct(m && m.pct) };
  if (m.type === 'count') {
    const n = before && before.type === 'count' ? whole(before.n) : whole(m.n);
    return { type: 'count', target: whole(m.target, 1), n };
  }
  if (m.type === 'habit') return whole(m.target) ? { type: 'habit', habitId: m.habitId, target: whole(m.target) } : { type: 'habit', habitId: m.habitId };
  return { type: m.type, ritualId: m.ritualId };
}

// Replaces one period's goals with `goals` ([{ id, title, measure }], in
// order; the caller picks the ids, new ones included). Untitled rows are
// dropped. A goal kept by id keeps its count and its log; a changed
// percentage is logged on `day`. An emptied period keeps one archived marker,
// so it stays empty rather than showing the previous period's goals again
// (goalsFor).
export function saveGoals(state, level, period, goals, day) {
  const s = clone(state);
  const kept = goals.filter((g) => String(g.title || '').trim()).map((g) => {
    const before = s.goals.find((x) => x.id === g.id);
    const measure = cleanMeasure(g.measure, before && before.measure);
    const out = { id: g.id, level, period, title: g.title.trim(), measure };
    if (before && before.log && before.measure.type === measure.type) out.log = before.log;
    if (measure.type === 'manual' && (before ? before.measure.pct !== measure.pct : measure.pct)) logValue(out, measure.pct, day);
    return out;
  });
  const others = s.goals.filter((g) => !(g.level === level && g.period === period));
  const marker = { id: `none-${level}-${period}`, level, period, title: '', archived: true, measure: { type: 'manual', pct: 0 } };
  s.goals = [...others, ...(kept.length ? kept : [marker])];
  return s;
}

// The goal to change on `today`. A goal carried over from an earlier period
// (goalsFor) belongs to that period: changing it there would rewrite last
// week. So the earlier period's goals are first copied into this one, with
// ids derived from the originals (two devices doing it agree), counts back
// at 0 and no log; the copy of `goalId` is returned.
function ownGoal(s, goalId, today) {
  const g = s.goals.find((x) => x.id === goalId);
  if (!g || !today) return g;
  const current = periodOf(g.level, today);
  if (g.period === current) return g;
  const copyId = `${g.id}~${current}`;
  if (!s.goals.some((x) => x.level === g.level && x.period === current)) {
    for (const x of s.goals.filter((y) => y.level === g.level && y.period === g.period && !y.archived)) {
      const m = x.measure.type === 'count' ? { ...x.measure, n: 0 } : { ...x.measure };
      s.goals.push({ id: `${x.id}~${current}`, level: x.level, period: current, title: x.title, measure: m });
    }
  }
  return s.goals.find((x) => x.id === copyId);
}

export function setGoalPct(state, goalId, pct, today) {
  const s = clone(state);
  const g = ownGoal(s, goalId, today);
  if (g) {
    g.measure = { type: 'manual', pct: clampPct(pct) };
    logValue(g, g.measure.pct, today);
  }
  return s;
}

// A counted goal: set the count, or add `delta` to it (never below 0).
export function setGoalCount(state, goalId, n, today) {
  const s = clone(state);
  const g = ownGoal(s, goalId, today);
  if (g && g.measure.type === 'count') {
    g.measure.n = whole(n);
    logValue(g, g.measure.n, today);
  }
  return s;
}

export function bumpGoal(state, goalId, delta, today) {
  const g = state.goals.find((x) => x.id === goalId);
  if (!g || g.measure.type !== 'count') return state;
  const n = g.period === periodOf(g.level, today) ? whole(g.measure.n) : 0;
  return setGoalCount(state, goalId, n + delta, today);
}

// ---- habits -----------------------------------------------------------------

export const cleanFreq = (f) => (f && f.type === 'weekly'
  ? { type: 'weekly', times: Math.max(1, Math.min(6, whole(f.times, 1))) }
  : { type: 'daily' });

const sameFreq = (a, b) => a.type === b.type && (a.type === 'daily' || a.times === b.times);

// A new habit, counted from `today` (earlier days show as "before it existed").
export function addHabit(state, { id, name }, freq, today) {
  const s = clone(state);
  const title = String(name || '').trim();
  if (!title || s.habits.some((h) => h.id === id)) return s;
  s.habits.push({ id, name: title, short: title, freq: cleanFreq(freq), createdDay: today, winNoun: `${title} days` });
  return s;
}

// New quotas: { habitId: freq }. A new quota counts from this week's Monday;
// the weeks before keep the one they had (pastFreq, see habits.js freqOn).
// Words that state the old quota go: the custom line under the name
// (it's computed from the quota instead), the featured card's note, and a
// plan of days when the habit becomes daily.
export function setHabitFreqs(state, freqs, today) {
  const s = clone(state);
  const monday = weekStart(today);
  for (const h of s.habits) {
    if (!(h.id in freqs)) continue;
    const next = cleanFreq(freqs[h.id]);
    if (sameFreq(next, h.freq)) continue;
    const past = h.pastFreq || [];
    const started = !h.createdDay || weekStart(h.createdDay) < monday;
    if (started && !past.some((p) => p.until === monday)) h.pastFreq = [...past.filter((p) => p.until < monday), { until: monday, freq: h.freq }];
    h.freq = next;
    delete h.sub;
    if (h.featured) delete h.featured.note;
    if (next.type === 'daily') delete h.plannedWeekdays;
  }
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

// Records what Fred paid: `entries` = [{ key, amount, missed }] from owing().
// The amount is frozen here, so later edits never change what was paid.
export function markPaid(state, entries, day) {
  const s = clone(state);
  if (!s.penalty) return s;
  s.penalty.paid = s.penalty.paid || {};
  for (const e of entries) s.penalty.paid[e.key] = { amount: e.amount, missed: e.missed, day };
  return s;
}

export function unmarkPaid(state, key) {
  const s = clone(state);
  if (s.penalty && s.penalty.paid) delete s.penalty.paid[key];
  return s;
}
