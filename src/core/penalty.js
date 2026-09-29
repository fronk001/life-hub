// The Luna rule: every week goal not fully met costs `euros`, paid to `payee`
// at the end of the week. Pure: the app only tallies and prepares the
// payment; the money moves in Fred's own Revolut app.
//
// state.penalty = { since: '2026-09-28' (a Monday), euros: 5, payee: 'Luna',
//                   revolut: 'handle' (personal: seed.local.js), paid: { '2026-W40': { amount, missed, day } } }
// No `penalty` in the record = the rule is off.

import { addDays, weekKey, weekStart, weekday } from './dates.js';
import { goalsFor, measure } from './goals.js';

export const defaultPenalty = () => ({ since: '2026-09-28', euros: 5, payee: 'Luna', paid: {} });

// The week goals of the week starting `monday` that are below 100%.
// Measured as of the week's Sunday, so a finished week reads the same later.
export function weekMisses(s, monday) {
  const { goals } = goalsFor(s.goals, 'week', monday);
  const sunday = addDays(monday, 6);
  const missed = goals.filter((g) => measure(g, s, sunday).value < 1).map((g) => g.title);
  return { missed, total: goals.length };
}

// What is owed now: weeks since the rule began, not yet marked paid, with at
// least one miss. The current week only counts from its Sunday (the review).
export function owing(s, today) {
  const p = s.penalty;
  if (!p) return [];
  const thisWeek = weekStart(today);
  const last = weekday(today) === 7 ? thisWeek : addDays(thisWeek, -7);
  const out = [];
  for (let monday = weekStart(p.since); monday <= last; monday = addDays(monday, 7)) {
    const key = weekKey(monday);
    if (p.paid && p.paid[key]) continue;
    const { missed } = weekMisses(s, monday);
    if (missed.length) out.push({ key, monday, missed, amount: missed.length * p.euros });
  }
  return out;
}

// This week so far, before it is due: how much it would cost if it ended now.
export function atStake(s, today) {
  const p = s.penalty;
  if (!p || weekStart(today) < weekStart(p.since)) return null;
  const monday = weekStart(today);
  const { missed, total } = weekMisses(s, monday);
  return { monday, missed, total, amount: missed.length * p.euros };
}

// Revolut's payment link. The amount is in cents; whether Revolut fills it in
// from the link is untested, so the screen always shows the amount as well.
export function revolutLink(p, amount) {
  if (!p || !/^[A-Za-z0-9._-]+$/.test(p.revolut || '')) return null;
  return `https://revolut.me/${p.revolut}?amount=${amount * 100}&currency=EUR`;
}
