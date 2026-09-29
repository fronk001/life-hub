// Boot: draw from this device's data straight away, then keep the screen
// current — ticks, other devices' changes, the day turning over.

import { act, get, isDemo, load, subscribe, sync, today } from '../data/store.js';
import { accountLine, closeSignIn, gate, openSignIn, signInForced, signInOpen, syncButton } from './account.js';
import { renderDesktop } from './desktop.js';
import { renderPhone } from './phone.js';

const root = document.getElementById('app');
const narrow = matchMedia('(max-width: 759px)');
// A real phone (not a narrow laptop window): hides laptop-only launchers.
const touchPhone = matchMedia('(hover: none) and (pointer: coarse)');
const ui = { expanded: new Set(), syncOpen: false };
let drawnDay = null;

function render() {
  drawnDay = today();
  const s = get();
  const st = sync.status();
  if (!s) {
    // A new device with nothing on it yet: sign in, then the data arrives.
    root.className = 'is-gate';
    root.innerHTML = gate(st);
    if (st.mode === 'signed-out') openSignIn({ forced: true });
    return;
  }
  if (signInForced()) closeSignIn();
  const ctx = { s, day: drawnDay, phone: touchPhone.matches, ui, footer: accountLine(st), sync: syncButton(st, ui.syncOpen) };
  const phoneLayout = narrow.matches;
  root.className = phoneLayout ? 'is-phone' : 'is-desktop';
  root.innerHTML = (phoneLayout ? renderPhone(ctx) : renderDesktop(ctx)) +
    (isDemo ? '<div class="demo-badge">Demo data</div>' : '');
}

function closeSyncCard() {
  if (!ui.syncOpen) return;
  ui.syncOpen = false;
  render();
}

function signOut() {
  const { waiting } = sync.status();
  const lost = waiting
    ? `\n\n${waiting} ${waiting === 1 ? 'change hasn’t' : 'changes haven’t'} reached the database yet and would be lost.`
    : '';
  if (confirm(`Sign out of Life Hub on this device? Your data stays safe online.${lost}`)) {
    sync.signOut().then(() => location.reload());
  }
}

root.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const { id } = el.dataset;
  switch (el.dataset.act) {
    case 'habit': act.toggleHabit(id, el.dataset.day); break;
    case 'step': act.toggleStep(id, el.dataset.step); break;
    case 'start': act.startRitual(id); break;
    case 'ritual-done': act.toggleRitualDone(id); break;
    case 'launch':
      // Let the link open first: re-rendering now would detach the <a> and
      // the browser would silently drop the navigation.
      if (el.dataset.ritual) setTimeout(() => act.startRitual(el.dataset.ritual), 0);
      break;
    case 'goal': {
      const v = prompt(`Progress for “${el.dataset.title}” (0–100)`, el.dataset.pct);
      if (v !== null && v.trim() !== '' && Number.isFinite(Number(v))) act.setGoalPct(id, Number(v));
      break;
    }
    case 'expand':
      if (ui.expanded.has(id)) ui.expanded.delete(id);
      else ui.expanded.add(id);
      render();
      break;
    case 'sync':
      ui.syncOpen = !ui.syncOpen;
      render();
      break;
    case 'sign-in':
      ui.syncOpen = false;
      openSignIn();
      break;
    case 'sign-out': signOut(); break;
    case 'start-fresh':
      if (confirm('Start a new record online, from the starting set, with no history?\n\n' +
        'Only do this if your record is lost. If Life Hub has your ticks in another browser, sign in there instead.')) sync.startFresh();
      break;
    default:
  }
});

await load();
subscribe(render);
render();

// Wired only now: an event during loading would render with no data yet.
// The day turns over at 04:00; an app left open overnight must notice.
const refreshIfNewDay = () => { if (today() !== drawnDay) render(); };
setInterval(refreshIfNewDay, 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshIfNewDay(); });
narrow.addEventListener('change', render);
addEventListener('online', render);
addEventListener('offline', render);
// The sync card closes on a tap anywhere else, or Escape. A moment later, not
// during the click: re-rendering then would drop a launch link's navigation.
document.addEventListener('click', (e) => {
  if (ui.syncOpen && !e.target.closest('.sync, .sync-card')) setTimeout(closeSyncCard, 0);
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSyncCard(); });

// The published copy keeps itself on the device (sw.js), so the installed
// phone app opens instantly and offline. In src/ the version reads "dev" and
// nothing is kept: the dev server's files are always the ones on disk.
function keepOnDevice() {
  let controlled = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js').then((reg) => {
    // An installed phone app is resumed, not reopened: look for a new version then too.
    document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
  }, () => {});
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // The very first copy taking over is not an update: the page is current.
    if (!controlled) { controlled = true; return; }
    // A new version: reload to show it, unless that would wipe a half-typed
    // sign-in; then wait until the app is out of sight.
    if (document.hidden || !signInOpen()) location.reload();
    else document.addEventListener('visibilitychange', () => location.reload(), { once: true });
  });
}
if (document.querySelector('meta[name=app-version]').content !== 'dev' && 'serviceWorker' in navigator) keepOnDevice();
