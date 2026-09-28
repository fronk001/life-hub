// Made-up history for eyeballing the screens against the mockup (?demo).
// Lives under its own storage key and shows a "Demo data" badge, so it can
// never be mistaken for, or mixed into, the real record.

import { addDays, addMonths, firstWeekendSunday, monthKey, weekKey, weekStart, weekday } from '../core/dates.js';

// Small seeded PRNG so the demo looks the same every time.
function rng(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function baseSeed(today) {
  try {
    return (await import('./seed.local.js')).buildSeed(today);
  } catch {
    return (await import('./seed.example.js')).buildSeed(today);
  }
}

export async function buildDemo(today) {
  const s = await baseSeed(today);
  const start = addDays(weekStart(today), -10 * 7);
  for (const x of [...s.habits, ...s.rituals]) x.createdDay = start;

  const r = rng(40);
  const tick = (d, id) => ((s.checks[d] = s.checks[d] || {})[id] = true);
  const miss = addDays(today, -26); // one missed Mongolian day, a streak of 25 since
  for (let d = start; d < today; d = addDays(d, 1)) {
    const wd = weekday(d);
    if (d !== miss) tick(d, 'mn');
    if ([1, 2, 4, 6].includes(wd) && r() > 0.12) tick(d, 'gym');
    if (![5, 6].includes(wd) && r() > 0.3) tick(d, 'read');
    if (wd === 6 && r() > 0.15) tick(d, 'ride');
  }

  const at = (d, h) => Date.parse(`${d}T${String(h).padStart(2, '0')}:00:00Z`);
  const done = (d, minutes) => ({ steps: {}, startedAt: at(d, 9), done: true, doneDay: d, doneAt: at(d, 9) + minutes * 60000, minutes });
  s.runs.groceries = {};
  s.runs.review = {};
  for (let sun = addDays(start, 6); sun < today; sun = addDays(sun, 7)) {
    if (r() > 0.12) s.runs.groceries[weekKey(sun)] = done(sun, 35);
    const rev = done(sun, 18 + Math.floor(r() * 8));
    rev.steps = { score: true, goals: true, plan: true, check: true };
    s.runs.review[weekKey(sun)] = rev;
  }

  const prev = addMonths(monthKey(today), -1);
  const m = done(firstWeekendSunday(prev), 52);
  m.steps = { numbers: true, stocks: true, wealth: true };
  s.runs.money = { [prev]: m };
  const due = firstWeekendSunday(monthKey(today));
  if (today <= due) s.runs.money[monthKey(today)] = { steps: { numbers: true }, startedAt: Date.now() - 10 * 60000 };

  s.demo = true;
  return s;
}
