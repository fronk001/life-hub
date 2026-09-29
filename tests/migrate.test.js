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
