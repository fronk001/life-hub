// Generic starting set, committed so the public repo runs out of the box.
// The real one is seed.local.js, which is git-ignored.

export function buildSeed(today) {
  return {
    version: 1,
    launchers: [],
    habits: [
      {
        id: 'daily', name: 'Daily habit', short: 'Daily', sub: 'Daily · 5 minutes counts', freq: { type: 'daily' },
        createdDay: today, winNoun: 'sessions',
        featured: { title: 'Daily habit, 5 minutes', phoneTitle: 'Daily habit', blurb: 'Five minutes counts. Zero doesn’t.', note: '', doneLabel: 'Mark done' },
      },
    ],
    rituals: [],
    goals: [],
    checks: {},
    runs: {},
  };
}
