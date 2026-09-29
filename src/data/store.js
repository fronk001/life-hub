// The app's state: drawn instantly from this device's copy, changed only
// through core/actions.js, and synced with the online database in the
// background once Firebase is set up (engine.js does the work).
//
// Dev switches in the URL. None of them ever touches the real, synced record:
//   ?today=2026-10-01   pretend it is that day (on a separate local copy)
//   ?demo               made-up history under its own key
//   ?fake-sync=laptop   sync against a pretend server in this browser; a device
//                       called "phone" has no seed file, like the hosted app
//   ?reset              forget this copy and start again

import * as A from '../core/actions.js';
import { logicalDay } from '../core/dates.js';
import { migrate } from '../core/migrate.js';
import { createEngine } from './engine.js';
import { firebaseBackend } from './firebase.js';
import { firebaseConfig } from './firebase-config.js';

const params = new URLSearchParams(location.search);
export const isDemo = params.has('demo');
const fake = !isDemo && params.has('fake-sync') ? params.get('fake-sync') || 'laptop' : null;
const pretend = params.has('today');
const KEY = isDemo ? 'lifehub:demo' : fake ? `lifehub:fake:${fake}` : pretend ? 'lifehub:dev' : 'lifehub:v1';
const synced = !!fake || (KEY === 'lifehub:v1' && !!firebaseConfig);

export const today = () => params.get('today') || logicalDay(new Date());

// seed.local.js exists only on the laptop (it is git-ignored), so the hosted
// app never has a starting set of its own: it gets the data from the database.
let localFile = null;
const local = () => (localFile = localFile || (fake === 'phone' ? Promise.resolve(null) : import('./seed.local.js').catch(() => null)));

async function localSeed() {
  const m = await local();
  return m ? m.buildSeed(today()) : null;
}

async function seed() {
  if (isDemo) return (await import('./demo.js')).buildDemo(today());
  const s = await localSeed();
  if (s || synced) return s;
  return (await import('./seed.example.js')).buildSeed(today());
}

async function backend() {
  if (fake) {
    const { fakeBackend, fakeServer } = await import('./fake-backend.js');
    return fakeBackend({ server: fakeServer({ storage: localStorage }), storage: localStorage, device: fake });
  }
  return synced ? firebaseBackend(firebaseConfig) : null;
}

let engine = null;

export async function load() {
  // Changes to the live record that name personal addresses (seed.local.js,
  // upgradeLocal) are made by the laptop only, which runs the files as they
  // are ("dev"): the published copy has no such file, and asking for it
  // would cost the phone a request before its first paint.
  const onLaptop = document.querySelector('meta[name=app-version]').content === 'dev';
  const mine = onLaptop ? await local() : null;
  const upgrade = (s) => (mine && mine.upgradeLocal ? mine.upgradeLocal(migrate(s)) : migrate(s));
  engine = createEngine({ storage: localStorage, key: KEY, backend: await backend(), seed, upgrade });
  addEventListener('storage', (e) => engine.receive(e));
  return engine.load({ reset: params.has('reset') });
}

export const get = () => engine.get();
export const subscribe = (fn) => engine.subscribe(fn);

const commit = (fn) => engine.commit(fn(engine.get()));

export const act = {
  toggleHabit: (id, day) => commit((s) => A.toggleHabit(s, id, day)),
  toggleStep: (ritualId, stepId) => commit((s) => A.toggleStep(s, ritualId, stepId, today(), Date.now())),
  setStep: (ritualId, stepId, on) => commit((s) => A.setStep(s, ritualId, stepId, on, today(), Date.now())),
  startRitual: (ritualId) => commit((s) => A.startRitual(s, ritualId, today(), Date.now())),
  toggleRitualDone: (ritualId) => commit((s) => A.toggleRitualDone(s, ritualId, today(), Date.now())),
  setGoalPct: (goalId, pct) => commit((s) => A.setGoalPct(s, goalId, pct)),
  saveGoals: (level, period, goals) => commit((s) => A.saveGoals(s, level, period, goals)),
  setPlannedDays: (plan) => commit((s) => A.setPlannedDays(s, plan)),
};

export const sync = {
  status: () => engine.status(),
  signIn: (email, password) => engine.signIn(email, password),
  signOut: () => engine.signOut(),
  resetPassword: (email) => engine.resetPassword(email),
  startFresh: () => engine.startFresh(),
};
