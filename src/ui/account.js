// Sign-in and sync status: the sign-in form, a small pill that appears only
// when there is something to say, the account line at the bottom of the
// page, and the screen a new device shows before it has any data.
//
// The form lives outside #app on purpose: the views are re-rendered whole on
// every change, which would wipe a half-typed password.

import { sync } from '../data/store.js';
import { esc, plural } from './html.js';

const offline = (st) => st.mode === 'offline' || !navigator.onLine;

export function syncPill(st) {
  if (st.mode === 'off') return '';
  if (st.mode === 'signed-out') {
    return `<button class="sync-pill dark" data-act="sign-in">${st.claimed ? 'Signed out · Sign in' : 'Sign in to sync'}</button>`;
  }
  if (st.mode === 'error') return '<button class="sync-pill red" data-act="sync-error">Not syncing</button>';
  if (offline(st)) {
    return `<div class="sync-pill amber">Offline${st.waiting ? ` · ${st.waiting} ${plural(st.waiting, 'change')} saved here` : ''}</div>`;
  }
  if (st.waiting && st.slow) return '<div class="sync-pill">Syncing…</div>';
  return '';
}

const signOutLink = '<button data-act="sign-out">Sign out</button>';

export function accountLine(st) {
  return st.email ? `<footer class="acct">Signed in as ${esc(st.email)} · ${signOutLink}</footer>` : '';
}

// Before this device has any data: first visit on the phone.
export function gate(st) {
  const msg = {
    connecting: 'Loading your data…',
    offline: 'You’re offline. The first time on a new device, Life Hub needs a connection to fetch your data.',
    empty: 'Nothing is stored online yet. Open Life Hub on your laptop, in the browser you normally use, and sign in there: that uploads your record, and it appears here straight after.',
    error: `Couldn’t load your data (${esc(st.error)}).`,
  }[st.mode];
  return `
  <div class="gate">
    <div class="eyebrow">Life Hub</div>
    ${msg ? `<p>${msg}</p>` : ''}
    ${st.canStartFresh ? '<p class="acct">No record anywhere? <button data-act="start-fresh">Start from the starting set</button></p>' : ''}
    ${st.email && st.mode !== 'connecting' ? `<p class="acct">Signed in as ${esc(st.email)} · ${signOutLink}</p>` : ''}
  </div>`;
}

export function syncProblem(st) {
  const hint = /permission/.test(st.error)
    ? 'The database refused access. Check the “Paste the rules” step in SETUP.md.'
    : 'Your changes are kept on this device and are sent again the next time Life Hub opens.';
  return `Life Hub couldn’t sync (${st.error}).\n\n${hint}`;
}

// ---- the sign-in form -----------------------------------------------------

const MESSAGES = {
  'auth/invalid-credential': 'That email and password don’t match.',
  'auth/wrong-password': 'That email and password don’t match.',
  'auth/user-not-found': 'That email and password don’t match.',
  'auth/invalid-email': 'That doesn’t look like an email address.',
  'auth/missing-password': 'Type your password too.',
  'auth/too-many-requests': 'Too many tries. Wait a few minutes, then try again.',
  'auth/network-request-failed': 'No internet connection. Try again once you’re online.',
  'auth/user-disabled': 'This account is switched off in the Firebase console.',
};
const explain = (e) => MESSAGES[e && e.code] || `Couldn’t sign in (${(e && (e.code || e.message)) || e}).`;

const FORM = `
<form class="signin-card" novalidate>
  <div class="eyebrow">Life Hub</div>
  <h1 id="signin-title">Sign in</h1>
  <p class="lead">Your habits, rituals and goals, the same on every device you sign in on.</p>
  <label>Email<input name="email" type="email" autocomplete="username" autocapitalize="off" spellcheck="false"></label>
  <label>Password<input name="password" type="password" autocomplete="current-password"></label>
  <p class="msg" role="alert" hidden></p>
  <button class="btn dark" type="submit">Sign in</button>
  <div class="links">
    <button type="button" class="btn text" data-f="forgot">Forgot password?</button>
    <button type="button" class="btn text" data-f="cancel">Not now</button>
  </div>
</form>`;

let box = null;

function say(text, tone = 'error') {
  const m = box.querySelector('.msg');
  m.textContent = text;
  m.className = `msg ${tone}`;
  m.hidden = !text;
}

function build() {
  box = document.createElement('div');
  box.className = 'signin';
  box.hidden = true;
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-labelledby', 'signin-title');
  box.innerHTML = FORM;
  document.body.append(box);
  const form = box.querySelector('form');
  const submit = form.querySelector('[type=submit]');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = form.email.value.trim();
    const password = form.password.value;
    if (!email || !password) return say('Type your email and your password.');
    submit.disabled = true;
    submit.textContent = 'Signing in…';
    say('');
    try {
      await sync.signIn(email, password);
      form.password.value = '';
      closeSignIn();
    } catch (err) {
      say(explain(err));
    } finally {
      submit.disabled = false;
      submit.textContent = 'Sign in';
    }
  });

  box.addEventListener('click', async (e) => {
    const f = e.target.closest('[data-f]');
    if (!f) return;
    if (f.dataset.f === 'cancel') return closeSignIn();
    const email = form.email.value.trim();
    if (!email) return say('Type your email above first, then tap “Forgot password?” again.');
    try {
      await sync.resetPassword(email);
      say(`If ${email} is your Life Hub account, an email with a link to choose a new password is on its way.`, 'info');
    } catch (err) {
      say(explain(err));
    }
  });

  box.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !box.classList.contains('forced')) closeSignIn();
  });
}

// `forced`: there is nothing to show without signing in (a new phone), so
// the form fills the screen and can't be dismissed.
export function openSignIn({ forced = false } = {}) {
  if (!box) build();
  box.classList.toggle('forced', forced);
  box.querySelector('[data-f=cancel]').hidden = forced;
  if (!box.hidden) return;
  box.hidden = false;
  say('');
  if (!forced) box.querySelector('input[name=email]').focus();
}

export function closeSignIn() {
  if (box) box.hidden = true;
}

export const signInForced = () => !!box && !box.hidden && box.classList.contains('forced');
export const signInOpen = () => !!box && !box.hidden;
