// Keeps habits linked to another app ticked (core/links.js has the rules).
// While signed in, it listens to the Mongolian app's history for this year
// (and next year's, around New Year: a session at 00:30 on 1 January is in
// next year's document but counts for 31 December), and ticks every studied
// day that isn't ticked yet. The ticks are ordinary ones, so they sync,
// count for goals and streaks, and reach the phone like any other.
// Laptop and phone may both add the same tick; that's harmless.

import { toggleHabit } from '../core/actions.js';
import { addDays, yearKey } from '../core/dates.js';
import { isDone } from '../core/habits.js';
import { linkedDays, linkedTo } from '../core/links.js';

const APP = 'mongolian';

export const yearsAround = (day) => [...new Set([yearKey(addDays(day, -7)), yearKey(day), yearKey(addDays(day, 1))])];

export function watchLinks({ engine, backend, today }) {
  let stop = null;
  let rows = {};
  let studied = new Map(); // habitId -> Set of days with a real session

  function apply() {
    const s = engine.get();
    if (!s) return;
    studied = new Map();
    let next = s;
    for (const h of linkedTo(s, APP)) {
      const days = linkedDays(h, rows);
      studied.set(h.id, days);
      for (const d of days) if (!isDone(next.checks, d, h.id)) next = toggleHabit(next, h.id, d);
    }
    if (next !== s) engine.commit(next);
  }

  engine.watchUser((uid) => {
    if (stop) stop();
    stop = null;
    rows = {};
    studied = new Map();
    if (uid && backend && backend.listenApp) {
      stop = backend.listenApp(uid, APP, yearsAround(today()), (r) => {
        rows = r;
        apply();
      }, () => {}); // not reachable: the habit is ticked by hand as before
    }
  });
  engine.subscribe(apply);

  return { studied: (habitId, day) => !!(studied.get(habitId) && studied.get(habitId).has(day)) };
}
