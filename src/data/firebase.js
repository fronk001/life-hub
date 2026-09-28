// The online database: Firebase Auth (email + password) and Cloud Firestore,
// behind the small interface engine.js expects. The only file that knows
// Firebase exists.
//
// There is no build step on this machine, so the SDK comes as ES modules
// straight from Google's CDN, fetched after the first paint: the screen
// never waits for it. Firestore keeps its cache in memory only; the durable
// copy of unsent changes is engine.js's queue in localStorage, which also
// works when the SDK itself can't be downloaded (offline).

const V = '12.19.0';
const sdk = (name) => import(`https://www.gstatic.com/firebasejs/${V}/firebase-${name}.js`);

export function firebaseBackend(config) {
  let fb = null;
  let booting = null;
  let failed = false;

  function boot() {
    // A browser remembers a failed module download for the life of the
    // page and won't try again, so once online again the only way to get
    // the SDK is a reload: instant, since the screen draws from this
    // device's copy, and the queue of unsent changes survives it.
    if (failed) {
      location.reload();
      return new Promise(() => {});
    }
    booting = booting || Promise.all([sdk('app'), sdk('auth'), sdk('firestore')]).then(([app, A, F]) => {
      const a = app.initializeApp(config);
      // initializeAuth without the popup/redirect helpers: email + password
      // needs none of them, and they would load an extra iframe.
      const auth = A.initializeAuth(a, { persistence: [A.indexedDBLocalPersistence, A.browserLocalPersistence] });
      fb = { A, F, auth, db: F.getFirestore(a) };
      return fb;
    }, (e) => {
      failed = true;
      throw e;
    });
    return booting;
  }

  // engine.js marks removed fields with backend.DEL; write() swaps each
  // marker for Firestore's own deleteField().
  const DEL = Symbol('delete');
  const swap = (v) => {
    if (v === DEL) return fb.F.deleteField();
    if (v && typeof v === 'object' && !Array.isArray(v)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, swap(x)]));
    return v;
  };

  const data = (uid, id) => fb.F.doc(fb.db, 'users', uid, 'data', id);

  const backend = {
    DEL,

    async start(onUser) {
      const { A, auth } = await boot();
      A.onAuthStateChanged(auth, (u) => onUser(u ? { uid: u.uid, email: u.email || '' } : null));
    },

    async signIn(email, password) {
      const { A, auth } = await boot();
      await A.signInWithEmailAndPassword(auth, email, password);
    },

    async signOut() {
      const { A, auth } = await boot();
      await A.signOut(auth);
    },

    async resetPassword(email) {
      const { A, auth } = await boot();
      await A.sendPasswordResetEmail(auth, email);
    },

    listen(uid, onDocs, onError) {
      const { F, db } = fb;
      return F.onSnapshot(F.collection(db, 'users', uid, 'data'), { includeMetadataChanges: true }, (snap) => {
        const docs = {};
        snap.forEach((d) => { docs[d.id] = d.data(); });
        onDocs({ docs, fromCache: snap.metadata.fromCache });
      }, onError);
    },

    write(uid, writes) {
      const batch = fb.F.writeBatch(fb.db);
      for (const w of writes) batch.set(data(uid, w.id), swap(w.data), { merge: w.merge });
      return batch.commit();
    },
  };
  return backend;
}
