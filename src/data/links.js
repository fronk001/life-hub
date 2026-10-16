// Keeps habits linked to another app ticked (core/links.js has the rules).
// While signed in, it listens to each linked app's days for this year (and
// next year's, around New Year: a session at 00:30 on 1 January is in next
// year's document but counts for 31 December), and ticks every day done
// there that isn't ticked yet. The ticks are ordinary ones, so they sync,
// count for goals and streaks, and reach the phone like any other.
// Laptop and phone may both add the same tick; that's harmless.
//
// The apps, all in this Firebase account (users/{uid}/<app>/YYYY, `history`):
//   mongolian  a finished lesson (../mongolian, since 16 Oct 2026)
//   gym        a ticked set (../gym, since 16 Oct 2026)

import { toggleHabit } from '../core/actions.js';
import { addDays, yearKey } from '../core/dates.js';
import { isDone } from '../core/habits.js';
import { linkedDays, linkedTo } from '../core/links.js';

export const APPS = { mongolian: 'the Mongolian app', gym: 'the Gym app' };

export const yearsAround = (day) => [...new Set([yearKey(addDays(day, -7)), yearKey(day), yearKey(addDays(day, 1))])];

export function watchLinks({ engine, backend, today }) {
  let stops = [];
  let rows = {}; // app -> rows by day
  let studied = new Map(); // habitId -> Set of days done in its app

  function apply() {
    const s = engine.get();
    if (!s) return;
    studied = new Map();
    let next = s;
    for (const app of Object.keys(APPS)) {
      for (const h of linkedTo(s, app)) {
        const days = linkedDays(h, rows[app]);
        studied.set(h.id, days);
        for (const d of days) if (!isDone(next.checks, d, h.id)) next = toggleHabit(next, h.id, d);
      }
    }
    if (next !== s) engine.commit(next);
  }

  engine.watchUser((uid) => {
    stops.forEach((stop) => stop());
    stops = [];
    rows = {};
    studied = new Map();
    if (uid && backend && backend.listenApp) {
      stops = Object.keys(APPS).map((app) => backend.listenApp(uid, app, yearsAround(today()), (r) => {
        rows[app] = r;
        apply();
      }, () => {})); // not reachable: the habit is ticked by hand as before
    }
  });
  engine.subscribe(apply);

  return { studied: (habitId, day) => !!(studied.get(habitId) && studied.get(habitId).has(day)) };
}
