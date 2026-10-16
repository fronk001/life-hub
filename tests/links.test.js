// A finished Mongolian lesson ticks the Mongolian habit (core/links.js,
// data/links.js), against the pretend server with two devices.
import { test, eq, ok } from './harness.js';
import { state, ticks } from './fixtures.js';
import { toggleHabit } from '../src/core/actions.js';
import { linkedDays, sessionDays } from '../src/core/links.js';
import { migrate } from '../src/core/migrate.js';
import { createEngine } from '../src/data/engine.js';
import { FAKE_ACCOUNTS, fakeBackend, fakeServer } from '../src/data/fake-backend.js';
import { watchLinks, yearsAround } from '../src/data/links.js';

const [FRED] = FAKE_ACCOUNTS;
const at = (iso) => Date.parse(iso);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, what, ms = 3000) {
  for (const t = Date.now(); Date.now() - t < ms; await sleep(10)) if (fn()) return;
  throw new Error(`timed out waiting until ${what}`);
}
function memory() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

const linked = (since = '2026-10-16') => state({
  habits: [{ id: 'mn', name: 'Mongolian', freq: { type: 'daily' }, createdDay: '2026-09-28', link: { app: 'mongolian', since } }],
});

test('a session counts for Life Hub’s day, which runs until 04:00', () => {
  const days = sessionDays({
    '2026-10-20': { firstAt: at('2026-10-19T22:30:00Z'), lastAt: at('2026-10-20T18:00:00Z') }, // 00:30 and 20:00 Amsterdam
    '2026-10-22': { firstAt: at('2026-10-22T07:00:00Z'), lastAt: at('2026-10-22T07:00:00Z') },
    '2026-10-24': { reviews: 3 }, // written before the app kept times: its calendar date
  });
  eq([...days].sort(), ['2026-10-19', '2026-10-20', '2026-10-22', '2026-10-24']);
});

test('only days from the link’s start count', () => {
  const rows = { '2026-10-15': { reviews: 1 }, '2026-10-16': { reviews: 1 } };
  eq([...linkedDays(linked().habits[0], rows)], ['2026-10-16']);
  eq(linkedDays({ id: 'gym' }, rows).size, 0, 'an unlinked habit');
});

test('a studied day can’t be unticked by hand; other days can', () => {
  const s = state({ checks: ticks('mn', ['2026-10-20', '2026-10-21']) });
  eq(toggleHabit(s, 'mn', '2026-10-20', true).checks['2026-10-20'], { mn: true });
  eq(toggleHabit(s, 'mn', '2026-10-21', false).checks['2026-10-21'], undefined);
});

test('the upgrade links the Mongolian habit from 16 October', () => {
  const s = migrate({ version: 3, habits: [{ id: 'mn', launcherId: 'mongolian', freq: { type: 'daily' } }, { id: 'gym', freq: { type: 'daily' } }] });
  eq(s.habits.map((h) => h.link), [{ app: 'mongolian', since: '2026-10-16' }, undefined]);
  eq(migrate(s), s, 'done once');
});

test('around New Year, next year’s document is watched too', () => {
  eq(yearsAround('2026-12-31'), ['2026', '2027']);
  eq(yearsAround('2027-01-03'), ['2026', '2027']);
  eq(yearsAround('2026-10-16'), ['2026']);
});

async function device(server, name, data) {
  const storage = memory();
  if (data) storage.setItem('lifehub:v1', JSON.stringify(data)); // the laptop's own record
  const backend = fakeBackend({ server, storage, device: name });
  const engine = createEngine({ storage, key: 'lifehub:v1', backend, seed: async () => null });
  const links = watchLinks({ engine, backend, today: () => '2026-10-20' });
  await engine.load();
  return { backend, engine, links, done: (day) => !!(engine.get() && engine.get().checks[day] && engine.get().checks[day].mn) };
}

test('a lesson in the Mongolian app ticks Life Hub on both devices, offline too', async () => {
  const server = fakeServer();
  const laptop = await device(server, 'laptop', linked());
  await laptop.engine.signIn(FRED.email, FRED.password);
  await until(() => laptop.engine.status().mode === 'live', 'the laptop is live');
  const phone = await device(server, 'phone', null);
  await phone.engine.signIn(FRED.email, FRED.password);
  await until(() => phone.engine.status().mode === 'live', 'the phone is live');

  server.putApp(FRED.uid, 'mongolian', '2026', { history: { '2026-10-15': { reviews: 2 }, '2026-10-20': { firstAt: at('2026-10-19T22:30:00Z'), lastAt: at('2026-10-19T22:30:00Z') } } });
  await until(() => phone.done('2026-10-19') && laptop.done('2026-10-19'), 'the 00:30 lesson ticks the evening before');
  ok(!laptop.done('2026-10-20') && !laptop.done('2026-10-15'), 'not the calendar day, and nothing before the start');
  ok(phone.links.studied('mn', '2026-10-19'));

  laptop.engine.commit(toggleHabit(laptop.engine.get(), 'mn', '2026-10-19', laptop.links.studied('mn', '2026-10-19')));
  ok(laptop.done('2026-10-19'), 'the lesson wins');

  phone.backend.setOnline(false);
  server.putApp(FRED.uid, 'mongolian', '2026', { history: { '2026-10-20': { firstAt: at('2026-10-19T22:30:00Z'), lastAt: at('2026-10-20T18:00:00Z') } } });
  await until(() => laptop.done('2026-10-20'), 'the laptop ticks the evening lesson');
  ok(!phone.done('2026-10-20'), 'the phone is offline');
  phone.backend.setOnline(true);
  await until(() => phone.done('2026-10-20'), 'the phone catches up');
  await sleep(50);
  eq(laptop.engine.status().waiting + phone.engine.status().waiting, 0, 'nothing left unsent');
});
