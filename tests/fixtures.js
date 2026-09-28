// Shared test data, shaped like the real seed but with fixed dates.

export const CREATED = '2026-09-28'; // Monday, week 40

export const habits = [
  { id: 'mn', name: 'Mongolian', freq: { type: 'daily' }, createdDay: CREATED, winNoun: 'Mongolian sessions' },
  { id: 'gym', name: 'Gym', freq: { type: 'weekly', times: 4 }, createdDay: CREATED, winNoun: 'gym sessions' },
  { id: 'ride', name: 'Dressage', freq: { type: 'weekly', times: 1 }, plannedWeekdays: [6], createdDay: CREATED, winNoun: 'dressage lessons' },
];

export const rituals = [
  { id: 'groceries', name: 'Groceries run', schedule: { type: 'weekly', weekday: 7 }, createdDay: CREATED, winNoun: 'grocery runs' },
  {
    id: 'money', name: 'Money review', schedule: { type: 'monthly', rule: 'first-weekend' }, duration: 60, createdDay: CREATED,
    steps: [{ id: 'numbers', label: 'Update Numbers' }, { id: 'stocks', label: 'Upload stock purchases', optional: true }, { id: 'wealth', label: 'Update Wealth Excel' }],
  },
  {
    id: 'review', name: 'Weekly review', schedule: { type: 'weekly', weekday: 7 }, duration: 20, createdDay: CREATED,
    steps: [{ id: 'a', label: 'Score the week' }, { id: 'b', label: 'Pick goals' }],
  },
];

export const byId = (list, id) => list.find((x) => x.id === id);

export const state = (extra = {}) => ({ habits, rituals, goals: [], checks: {}, runs: {}, ...extra });

// checks for a habit on the given days
export function ticks(id, days, into = {}) {
  for (const d of days) (into[d] = into[d] || {})[id] = true;
  return into;
}

export const MIN = 60000;
