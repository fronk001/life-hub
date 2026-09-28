// The data engine behind store.js: the state kept on this device (so the
// screen draws instantly), changed only through core/actions.js, and — when
// given a backend — kept in step with the online database in the background.
//
// The rules, in order of importance:
// - Nothing typed is lost. Every change made while signed in is queued in
//   storage until the server confirms it, so ticks made offline, or before
//   the database code has even loaded, go up on the next chance.
// - The server wins. Once signed in, whatever it holds replaces this
//   device's copy (with this device's unsent changes laid on top).
// - First sign-in: if the server holds nothing yet, this device's data is
//   uploaded — that is how the laptop's record gets online. A device with
//   nothing to upload (the phone, a fresh browser) waits until the data
//   appears; it never puts a starting set online unless Fred asks.
//
// `backend` is firebase.js in the app, fake-backend.js in tests:
//   start(onUser)                  resolves once loaded; calls onUser(user|null) on every change
//   signIn(email, pw) · signOut() · resetPassword(email)
//   listen(uid, onDocs, onError)   onDocs({ docs, fromCache }); returns unsubscribe
//   write(uid, writes)             [{ id, data, merge }], one atomic batch; resolves when stored

import { diff, fromDocs, patchesFor, toDocs } from '../core/sync.js';

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

// A change the server hasn't confirmed after this long gets a "Syncing…" pill.
const SLOW_MS = 5000;

export function createEngine({ storage, key, backend = null, seed }) {
  const META = `${key}:sync`; // { owner: uid this copy belongs to, pending: [{ id, at, ops }] }
  let state = null;
  let meta = { owner: null, pending: [] };
  let user = null;
  let mode = backend ? 'starting' : 'off';
  let error = '';
  let unlisten = null;
  let uploading = false;
  let fresh = null; // a starting set this device could begin a record with
  let sent = new Set();
  const subs = new Set();

  const notify = () => subs.forEach((fn) => fn());

  function readJSON(k) {
    try {
      const raw = storage.getItem(k);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
  function writeJSON(k, v) {
    try {
      if (v === null) storage.removeItem(k);
      else storage.setItem(k, JSON.stringify(v));
    } catch {
      // Private browsing or full storage: the app still works for this visit.
    }
  }
  const save = () => writeJSON(key, state);
  // Re-read before every change: another tab may have queued changes too.
  const readMeta = () => (meta = readJSON(META) || { owner: null, pending: [] });
  const saveMeta = () => writeJSON(META, meta.owner || meta.pending.length ? meta : null);

  // Sticky until the next sign-in: a refused write shouldn't be hidden by
  // the next good snapshot.
  function fail(e) {
    error = (e && (e.code || e.message)) || String(e);
    notify();
  }

  function send(batch) {
    if (sent.has(batch.id)) return;
    sent.add(batch.id);
    backend.write(user.uid, patchesFor(batch.ops, backend.DEL)).then(() => {
      readMeta();
      meta.pending = meta.pending.filter((b) => b.id !== batch.id);
      saveMeta();
      notify();
    }, fail); // stays queued: the next start sends it again
    setTimeout(notify, SLOW_MS + 100);
  }

  const canSend = () => !!(user && meta.owner === user.uid);

  function flush() {
    if (canSend()) meta.pending.forEach(send);
  }

  // Only ever uploads data this device already held, or a starting set Fred
  // asked for: a browser that happens to sign in first must not put a blank
  // record online for the real one to give way to.
  async function upload(u, data = state) {
    if (!data) {
      fresh = await seed(); // offered on the "nothing online yet" screen, never used unasked
      if (u !== user) return;
      mode = 'empty';
      notify();
      return;
    }
    uploading = true;
    state = data;
    save();
    meta = { owner: u.uid, pending: [] };
    saveMeta();
    const docs = toDocs(data);
    backend.write(u.uid, Object.entries(docs).map(([id, d]) => ({ id, data: d, merge: false })))
      .then(() => { uploading = false; }, (e) => { uploading = false; fail(e); });
    notify();
  }

  function onDocs({ docs, fromCache }) {
    if (!docs.main) {
      // Only the server's word counts: an empty offline cache proves nothing.
      if (!fromCache && !uploading && mode !== 'empty') upload(user);
      return;
    }
    if (readMeta().owner !== user.uid) {
      meta = { owner: user.uid, pending: [] }; // this device's unsynced copy gives way
      saveMeta();
    }
    const next = fromDocs(docs);
    if (!state || diff(state, next).length) {
      state = next;
      save();
    }
    mode = 'live';
    notify();
  }

  function onUser(u) {
    if (unlisten) unlisten();
    unlisten = null;
    user = u;
    sent = new Set();
    uploading = false;
    readMeta();
    if (!u) {
      mode = 'signed-out';
      notify();
      return;
    }
    if (meta.owner && meta.owner !== u.uid) {
      // Another account's data is on this device: it isn't ours to show.
      state = null;
      save();
      meta = { owner: null, pending: [] };
      saveMeta();
    }
    mode = 'connecting';
    error = '';
    flush();
    unlisten = backend.listen(u.uid, onDocs, fail);
    notify();
  }

  // No connection to fetch the database code: carry on locally, and try
  // again when the connection returns or the app comes back into view.
  function retry() {
    if (mode !== 'offline' || !navigator.onLine || document.hidden) return;
    removeEventListener('online', retry);
    document.removeEventListener('visibilitychange', retry);
    start();
  }

  function start() {
    backend.start(onUser).catch(() => {
      mode = 'offline';
      notify();
      addEventListener('online', retry);
      document.addEventListener('visibilitychange', retry);
    });
  }

  return {
    async load({ reset = false } = {}) {
      if (reset) {
        writeJSON(key, null);
        writeJSON(META, null);
      }
      state = readJSON(key);
      readMeta();
      if (!state && !backend) {
        state = await seed();
        save();
      }
      if (backend) start();
      return state;
    },

    get: () => state,

    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },

    commit(next) {
      const ops = diff(state, next);
      state = next;
      save();
      if (ops.length && backend && readMeta().owner) {
        const batch = { id: newId(), at: Date.now(), ops };
        meta.pending.push(batch);
        saveMeta();
        if (canSend()) send(batch);
      }
      notify();
    },

    status() {
      const oldest = meta.pending.length ? meta.pending[0].at : null;
      return {
        mode: error ? 'error' : mode, // off starting offline signed-out connecting live empty error
        email: user ? user.email : '',
        claimed: !!meta.owner,
        waiting: meta.pending.length,
        slow: oldest !== null && Date.now() - oldest > SLOW_MS,
        canStartFresh: mode === 'empty' && !!fresh,
        error,
      };
    },

    // "Nothing online yet" and no record anywhere: begin from the starting set.
    startFresh() {
      if (mode === 'empty' && fresh && user) {
        mode = 'connecting';
        upload(user, fresh);
      }
    },

    signIn: (email, password) => backend.signIn(email, password),
    resetPassword: (email) => backend.resetPassword(email),

    // Signing out forgets this device's copy; the online record is untouched.
    async signOut() {
      await backend.signOut();
      state = null;
      meta = { owner: null, pending: [] };
      writeJSON(key, null);
      writeJSON(META, null);
    },

    // Another tab changed storage.
    receive(e) {
      if (e.key === key) {
        state = e.newValue ? JSON.parse(e.newValue) : null;
        notify();
      } else if (e.key === META) {
        readMeta();
        notify();
      }
    },
  };
}
