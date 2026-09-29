// The sync engine end to end, against the pretend server: two "devices",
// each with its own storage, sharing one server.

import { test, eq, ok } from './harness.js';
import { state, ticks } from './fixtures.js';
import { toggleHabit } from '../src/core/actions.js';
import { migrate } from '../src/core/migrate.js';
import { fromDocs, same } from '../src/core/sync.js';
import { createEngine } from '../src/data/engine.js';
import { FAKE_ACCOUNTS, fakeBackend, fakeServer } from '../src/data/fake-backend.js';

const [FRED, OTHER] = FAKE_ACCOUNTS;
const KEY = 'lifehub:v1';
const clone = (x) => JSON.parse(JSON.stringify(x));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function until(fn, what, ms = 3000) {
  for (const t = Date.now(); Date.now() - t < ms; await sleep(10)) if (fn()) return;
  throw new Error(`timed out waiting until ${what}`);
}

function memory(init = {}) {
  const m = new Map(Object.entries(init).map(([k, v]) => [k, JSON.stringify(v)]));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

// Fred's laptop after step 2: real ticks in local storage, never synced.
const laptopData = () => state({ version: 1, checks: ticks('mn', ['2026-09-28', '2026-09-29', '2026-09-30']) });

async function device(server, { storage = memory(), seed = null, offline = false, name = 'd', upgrade } = {}) {
  const backend = fakeBackend({ server, storage, device: name });
  if (offline) backend.setOnline(false);
  const engine = createEngine({ storage, key: KEY, backend, seed: async () => (seed ? clone(seed) : null), upgrade });
  await engine.load();
  return { backend, engine, storage, mode: () => engine.status().mode };
}

const online = (server, uid = FRED.uid) => server.docs(uid);
const tick = (d, id, day) => d.engine.commit(toggleHabit(d.engine.get(), id, day));
const has = (d, day, id) => !!(d.engine.get() && d.engine.get().checks[day] && d.engine.get().checks[day][id]);

async function laptopSignedIn(server) {
  const laptop = await device(server, { storage: memory({ [KEY]: laptopData() }), name: 'laptop' });
  await laptop.engine.signIn(FRED.email, FRED.password);
  await until(() => laptop.mode() === 'live' && online(server).main, 'the laptop is live');
  return laptop;
}

test('laptop: the first sign-in uploads the data already on it', async () => {
  const server = fakeServer();
  const laptop = await device(server, { storage: memory({ [KEY]: laptopData() }), name: 'laptop' });
  eq(laptop.engine.get().checks, laptopData().checks, 'drawn from local data straight away');
  await until(() => laptop.mode() === 'signed-out', 'it knows nobody is signed in');
  eq(laptop.engine.status().claimed, false);
  await laptop.engine.signIn(FRED.email, FRED.password);
  await until(() => laptop.mode() === 'live' && online(server).main, 'the upload');
  ok(same(fromDocs(online(server)), laptopData()), 'the server holds exactly the laptop data');
  eq(laptop.engine.status().claimed, true);
});

test('phone: signs in with nothing on it and receives the laptop data', async () => {
  const server = fakeServer();
  await laptopSignedIn(server);
  const phone = await device(server, { name: 'phone' });
  eq(phone.engine.get(), null, 'nothing to show before signing in');
  await phone.engine.signIn(FRED.email, FRED.password);
  await until(() => phone.mode() === 'live', 'the phone is live');
  ok(same(phone.engine.get(), laptopData()));
});

test('a tick on one device shows up on the other and is confirmed', async () => {
  const server = fakeServer();
  const laptop = await laptopSignedIn(server);
  const phone = await device(server, { name: 'phone' });
  await phone.engine.signIn(FRED.email, FRED.password);
  await until(() => phone.mode() === 'live', 'the phone is live');
  tick(phone, 'gym', '2026-10-01');
  ok(has(phone, '2026-10-01', 'gym'), 'optimistic: on screen at once');
  await until(() => has(laptop, '2026-10-01', 'gym'), 'the laptop sees it');
  await until(() => phone.engine.status().waiting === 0, 'the phone queue empties');
});

test('two devices ticking different habits on the same new day both count', async () => {
  const server = fakeServer();
  const laptop = await laptopSignedIn(server);
  const phone = await device(server, { name: 'phone' });
  await phone.engine.signIn(FRED.email, FRED.password);
  await until(() => phone.mode() === 'live', 'the phone is live');
  tick(laptop, 'gym', '2026-10-02');
  tick(phone, 'mn', '2026-10-02');
  for (const d of [laptop, phone]) {
    await until(() => has(d, '2026-10-02', 'gym') && has(d, '2026-10-02', 'mn'), 'both ticks everywhere');
  }
  eq(fromDocs(online(server)).checks['2026-10-02'], { gym: true, mn: true });
});

test('offline ticks wait on the device, survive a restart, and go up when back online', async () => {
  const server = fakeServer();
  const laptop = await laptopSignedIn(server);
  const storage = memory();
  const phone = await device(server, { storage, name: 'phone' });
  await phone.engine.signIn(FRED.email, FRED.password);
  await until(() => phone.mode() === 'live', 'the phone is live');

  phone.backend.setOnline(false);
  tick(phone, 'read', '2026-10-03');
  await sleep(50);
  eq(phone.engine.status().waiting, 1, 'queued');
  ok(!has(laptop, '2026-10-03', 'read'), 'the laptop has not seen it');

  // The app is closed and reopened, still offline: the database code can't
  // even be downloaded.
  const again = await device(server, { storage, name: 'phone', offline: true });
  ok(has(again, '2026-10-03', 'read'), 'still on screen after the restart');
  await until(() => again.mode() === 'offline', 'it knows it is offline');
  eq(again.engine.status().waiting, 1, 'still queued');

  again.backend.setOnline(true);
  dispatchEvent(new Event('online'));
  await until(() => has(laptop, '2026-10-03', 'read'), 'the laptop gets it');
  await until(() => again.engine.status().waiting === 0, 'the queue empties');
  ok(has(again, '2026-10-03', 'read'));
});

test('a phone that signs in before the laptop has uploaded waits, then fills in', async () => {
  const server = fakeServer();
  const phone = await device(server, { name: 'phone' });
  await phone.engine.signIn(FRED.email, FRED.password);
  await until(() => phone.mode() === 'empty', 'it says nothing is online yet');
  eq(online(server), {}, 'and uploads nothing');
  await laptopSignedIn(server);
  await until(() => phone.mode() === 'live', 'the data arrives');
  ok(same(phone.engine.get(), laptopData()));
});

test('a browser with no data never puts a starting set online by itself', async () => {
  const server = fakeServer();
  // Signs in before the laptop has uploaded, with the seed file within reach.
  const fresh = await device(server, { seed: state({ version: 1 }), name: 'fresh' });
  await fresh.engine.signIn(FRED.email, FRED.password);
  await until(() => fresh.mode() === 'empty', 'it says nothing is online yet');
  await sleep(50);
  eq(online(server), {}, 'nothing uploaded');
  ok(fresh.engine.status().canStartFresh, 'but it offers to start fresh');
  // The laptop then signs in and its real record goes up, not a blank one.
  await laptopSignedIn(server);
  ok(same(fromDocs(online(server)), laptopData()));
  await until(() => fresh.mode() === 'live' && has(fresh, '2026-09-28', 'mn'), 'the fresh browser gets it');
});

test('starting fresh, when asked, uploads the starting set', async () => {
  const server = fakeServer();
  const d = await device(server, { seed: state({ version: 1 }), name: 'fresh' });
  await d.engine.signIn(FRED.email, FRED.password);
  await until(() => d.mode() === 'empty', 'nothing online');
  d.engine.startFresh();
  await until(() => d.mode() === 'live' && online(server).main, 'the starting set is online');
  ok(same(fromDocs(online(server)), state({ version: 1 })));
});

test('a fresh copy elsewhere takes the online data; it never overwrites it', async () => {
  const server = fakeServer();
  const laptop = await laptopSignedIn(server);
  tick(laptop, 'gym', '2026-10-01');
  await until(() => fromDocs(online(server)).checks['2026-10-01'], 'the tick is online');
  // A second browser on the laptop: an untouched starting set, never synced.
  const other = await device(server, { storage: memory({ [KEY]: state({ version: 1 }) }), name: 'other' });
  await other.engine.signIn(FRED.email, FRED.password);
  await until(() => other.mode() === 'live', 'the second browser is live');
  ok(has(other, '2026-10-01', 'gym') && has(other, '2026-09-28', 'mn'), 'it shows the real history');
  ok(fromDocs(online(server)).checks['2026-09-28'], 'the server kept it');
});

test('an empty offline cache is never mistaken for an empty server', async () => {
  const server = fakeServer();
  await laptopSignedIn(server);
  const storage = memory({ [KEY]: state({ version: 1 }) });
  const other = await device(server, { storage, name: 'other' });
  await other.engine.signIn(FRED.email, FRED.password);
  other.backend.setOnline(false); // drops before the first answer from the server
  await sleep(100);
  eq(other.mode(), 'connecting', 'still waiting for the server');
  ok(fromDocs(online(server)).checks['2026-09-28'], 'no upload happened');
  other.backend.setOnline(true);
  await until(() => other.mode() === 'live' && has(other, '2026-09-28', 'mn'), 'the real data arrives');
});

test('a wrong password is refused and nothing changes', async () => {
  const server = fakeServer();
  const laptop = await device(server, { storage: memory({ [KEY]: laptopData() }), name: 'laptop' });
  let code = '';
  await laptop.engine.signIn(FRED.email, 'not-it').catch((e) => { code = e.code; });
  eq(code, 'auth/invalid-credential');
  await sleep(50);
  eq(online(server), {});
  eq(laptop.engine.status().claimed, false);
});

test('signing out forgets this device’s copy, not the online one', async () => {
  const server = fakeServer();
  const laptop = await laptopSignedIn(server);
  await laptop.engine.signOut();
  eq(laptop.engine.get(), null);
  eq(laptop.storage.getItem(KEY), null);
  await until(() => laptop.mode() === 'signed-out', 'signed out');
  ok(online(server).main, 'the online record is untouched');
});

test('another account signing in on the device never sees the previous data', async () => {
  const server = fakeServer();
  const laptop = await laptopSignedIn(server);
  await laptop.backend.signOut(); // e.g. the session ended without "Sign out"
  await until(() => laptop.mode() === 'signed-out', 'signed out');
  await laptop.engine.signIn(OTHER.email, OTHER.password);
  await until(() => laptop.mode() === 'empty', 'the other account has nothing');
  eq(laptop.engine.get(), null, 'Fred’s data is gone from the device');
  eq(online(server, OTHER.uid), {}, 'and was not uploaded to the other account');
});

// ---- upgrading a record written by older code (core/migrate.js) -----------

const rituals = (d) => d.engine.get().rituals;
const onlineMain = (server) => online(server).main || {};

test('an older record online is upgraded by the first device with new code, and reaches the others', async () => {
  const server = fakeServer();
  const laptop = await laptopSignedIn(server); // old code: no upgrade
  const phone = await device(server, { name: 'phone', upgrade: migrate });
  await phone.engine.signIn(FRED.email, FRED.password);
  await until(() => onlineMain(server).version === 2, 'the upgrade online');
  eq(onlineMain(server).rituals.find((r) => r.id === 'groceries').schedule.weekday, 1);
  await until(() => phone.engine.status().waiting === 0, 'confirmed');
  await until(() => rituals(laptop).find((r) => r.id === 'money').schedule.from === 25, 'the laptop gets it');
  ok(has(laptop, '2026-09-28', 'mn') && has(phone, '2026-09-28', 'mn'), 'history untouched');
});

test('an older copy on a synced device shows upgraded at once, but only the server’s copy is upgraded online', async () => {
  const server = fakeServer();
  await laptopSignedIn(server);
  const storage = memory({ [KEY]: laptopData(), [`${KEY}:sync`]: { owner: FRED.uid, pending: [] } });
  const phone = await device(server, { storage, name: 'phone', offline: true, upgrade: migrate });
  eq(phone.engine.get().version, 2, 'upgraded on screen straight away');
  eq(phone.engine.status().waiting, 0, 'nothing queued from a copy the server hasn’t confirmed');
  phone.backend.setOnline(true);
  dispatchEvent(new Event('online'));
  await phone.engine.signIn(FRED.email, FRED.password);
  await until(() => onlineMain(server).version === 2 && phone.engine.status().waiting === 0, 'the upgrade from the server’s copy');
});

test('a refused upgrade is queued once, not again with every snapshot', async () => {
  const server = fakeServer();
  const laptop = await laptopSignedIn(server);
  const phone = await device(server, { name: 'phone', upgrade: migrate });
  phone.backend.write = () => Promise.reject(Object.assign(new Error('permission-denied'), { code: 'permission-denied' }));
  await phone.engine.signIn(FRED.email, FRED.password);
  await until(() => phone.mode() === 'error', 'the refusal');
  tick(laptop, 'gym', '2026-10-01');
  tick(laptop, 'read', '2026-10-01');
  await until(() => has(phone, '2026-10-01', 'read'), 'more snapshots');
  eq(phone.engine.status().waiting, 1);
  eq(phone.engine.get().version, 2, 'still shown upgraded');
  eq(onlineMain(server).version, 1);
});
