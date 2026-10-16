import { test, eq, ok } from './harness.js';
import { rituals, state } from './fixtures.js';
import { VERSION, migrate } from '../src/core/migrate.js';

// Fred's record as the laptop first uploaded it (28 Sep 2026), in the parts step 2 touches.
const v1 = () => state({
  version: 1,
  rituals: [
    { ...rituals[0], scheduleLabel: 'Weekly · Sunday' },
    { ...rituals[1], scheduleLabel: 'Monthly · first weekend' },
    {
      ...rituals[2],
      steps: [{ id: 'score', label: 'Score' }, { id: 'goals', label: 'Goals' }, { id: 'plan', label: 'Plan' }, { id: 'check', label: 'Check' }],
    },
  ],
});
const find = (s, id) => s.rituals.find((r) => r.id === id);

test('step 2: groceries to Mondays, the money review to the 25th, review steps open their screens', () => {
  const s = migrate(v1());
  eq(s.version, VERSION);
  eq(find(s, 'groceries').schedule, { type: 'weekly', weekday: 1, since: '2026-09-29' });
  eq(find(s, 'groceries').scheduleLabel, 'Weekly · Monday');
  eq(find(s, 'money').schedule, { type: 'monthly', from: 25, since: '2026-09-29' });
  eq(find(s, 'money').scheduleLabel, 'Monthly · 25th to end');
  eq(find(s, 'review').steps.map((x) => x.does), ['score', 'week-goals', 'plan', 'check-goals']);
  eq(find(s, 'review').schedule, rituals[2].schedule, 'the review stays on Sunday');
});

test('step 5: on the phone, the Mongolian launcher opens in Safari itself', () => {
  const url = 'https://fronk001.github.io/mongolian/';
  const s = migrate(state({ version: 4, launchers: [{ id: 'mongolian', url }, { id: 'portfolio', url: 'https://x.test/' }] }));
  eq(s.launchers.slice(0, 2).map((l) => l.phoneUrl), [`x-safari-${url}`, undefined], 'only Mongolian');
  const own = migrate(state({ version: 4, launchers: [{ id: 'mongolian', url, phoneUrl: 'https://other.test/' }] }));
  eq(own.launchers[0].phoneUrl, 'https://other.test/', 'a phone link already set stays');
});

test('the upgrade leaves the record it was given alone, and a second run changes nothing', () => {
  const before = v1();
  const once = migrate(before);
  eq(before.version, 1, 'not changed in place');
  ok(migrate(once) === once, 'already current: the very same record back');
  eq(migrate(null), null);
});

test('a ritual already moved some other way is left where it is', () => {
  const s = v1();
  find(s, 'groceries').schedule = { type: 'weekly', weekday: 3 };
  eq(find(migrate(s), 'groceries').schedule, { type: 'weekly', weekday: 3 });
  const bare = migrate(state({ version: 1, rituals: [] }));
  eq([bare.version, bare.rituals], [VERSION, []], 'a record without these rituals just gets the version');
});

test('step 7: Gym gets its own card and an Open app button, like Mongolian', () => {
  const s = migrate(state({ version: 6, launchers: [{ id: 'mongolian', url: 'https://fronk001.github.io/mongolian/' }],
    habits: [{ id: 'gym', name: 'Gym', freq: { type: 'weekly', times: 4 } }] }));
  const l = s.launchers.find((x) => x.id === 'gym');
  eq([l.url, l.phoneUrl, l.where], ['https://fronk001.github.io/gym/', 'x-safari-https://fronk001.github.io/gym/', 'everywhere']);
  eq(s.habits[0].launcherId, 'gym');
  ok(s.habits[0].featured && s.habits[0].featured.title);
  eq(migrate(s), s, 'done once');
  const mine = migrate(state({ version: 6, habits: [{ id: 'gym', freq: { type: 'weekly', times: 4 }, featured: { title: 'Mine' } }] }));
  eq(mine.habits[0].featured, { title: 'Mine' }, 'a card already set stays');
});
