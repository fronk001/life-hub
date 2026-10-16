// Brings a record written by older code up to the shape this code expects.
// The starting set only applies to a brand-new record, so a change to a
// ritual's schedule or steps reaches Fred's live record through here.
//
// Every device runs this on whatever it loads (engine.js), so each step
// must be pure and idempotent: two devices doing it must agree, and a step
// only touches what is still in its old shape. Bump VERSION with each step.

import { defaultPenalty } from './penalty.js';

export const VERSION = 7;

const clone = (x) => JSON.parse(JSON.stringify(x));

export const GYM_LAUNCHER = {
  id: 'gym', label: 'Open Gym app', short: 'Open app', where: 'everywhere',
  url: 'https://fronk001.github.io/gym/', phoneUrl: 'x-safari-https://fronk001.github.io/gym/',
};
export const GYM_FEATURED = {
  title: 'Gym, 4× a week',
  phoneTitle: 'Gym · 4× a week',
  blurb: 'Legs, chest and shoulders, back and biceps, in turn. Tick your sets in the Gym app: this ticks itself.',
  doneLabel: 'Mark gym done',
};

// Which screen each weekly review step opens (the `does` a step can have).
const REVIEW_DOES = { score: 'score', goals: 'week-goals', plan: 'plan', check: 'check-goals' };

const STEPS = {
  // 29 Sep 2026, Fred: groceries move to Mondays (the run and the Bonus week
  // start then), the money review to "between the 25th and the end of the
  // month", and the weekly review's steps open the screens that do them.
  // `since` keeps the move from making anything overdue retroactively:
  // Monday 28 September, the day before, was never a groceries day.
  2(s) {
    const ritual = (id) => (s.rituals || []).find((r) => r.id === id);
    const groceries = ritual('groceries');
    if (groceries && groceries.schedule.type === 'weekly' && groceries.schedule.weekday === 7) {
      groceries.schedule = { type: 'weekly', weekday: 1, since: '2026-09-29' };
      groceries.scheduleLabel = 'Weekly · Monday';
    }
    const money = ritual('money');
    if (money && money.schedule.type === 'monthly' && !money.schedule.from) {
      money.schedule = { type: 'monthly', from: 25, since: '2026-09-29' };
      money.scheduleLabel = 'Monthly · 25th to end';
    }
    const review = ritual('review');
    for (const step of (review && review.steps) || []) {
      if (REVIEW_DOES[step.id] && !step.does) step.does = REVIEW_DOES[step.id];
    }
  },
  // 29 Sep 2026, Fred: every week goal missed costs 5 euros for Luna, from
  // this week on (Monday 28 September).
  3(s) {
    if (!s.penalty) s.penalty = defaultPenalty();
  },
  // 16 Oct 2026, Fred: a finished Mongolian lesson ticks the Mongolian habit
  // by itself (core/links.js), from today on: earlier days stay as they are.
  4(s) {
    const mn = (s.habits || []).find((h) => h.launcherId === 'mongolian' || h.id === 'mn');
    if (mn && !mn.link) mn.link = { app: 'mongolian', since: '2026-10-16' };
  },
  // 16 Oct 2026, Fred: on the phone, "Open app" opens Mongolian in Safari
  // itself, not in the browser sheet an installed web app opens links in.
  // x-safari-https: is iOS's own scheme for that (iOS 17 and later).
  5(s) {
    const mn = (s.launchers || []).find((l) => l.id === 'mongolian');
    if (mn && !mn.phoneUrl && /^https:\/\//i.test(mn.url || '')) mn.phoneUrl = `x-safari-${mn.url}`;
  },
  // 16 Oct 2026, Fred: the new Gym app (../gym) ticks the Gym habit by
  // itself, on any day a set is ticked there, from today on.
  6(s) {
    const gym = (s.habits || []).find((h) => h.id === 'gym');
    if (gym && !gym.link) gym.link = { app: 'gym', since: '2026-10-16' };
  },
  // 16 Oct 2026, Fred: Gym gets what Mongolian has, its own green card with
  // an "Open app" button (on the phone in Safari itself, like Mongolian's).
  7(s) {
    s.launchers = s.launchers || [];
    if (!s.launchers.some((l) => l.id === 'gym')) s.launchers.push(GYM_LAUNCHER);
    const gym = (s.habits || []).find((h) => h.id === 'gym');
    if (gym && !gym.launcherId) gym.launcherId = 'gym';
    if (gym && !gym.featured) gym.featured = { ...GYM_FEATURED };
  },
};

export function migrate(state) {
  if (!state || (state.version || 1) >= VERSION) return state;
  const s = clone(state);
  for (let v = (s.version || 1) + 1; v <= VERSION; v += 1) STEPS[v](s);
  s.version = VERSION;
  return s;
}
