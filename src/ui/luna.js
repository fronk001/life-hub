// The Luna card, on both views: what this week's missed goals would cost, and
// what is owed from finished weeks, with a button that opens Revolut and one
// that records the payment once it is sent. Nothing here moves money.

import { isoWeek, shortLabel } from '../core/dates.js';
import { atStake, owing, revolutLink } from '../core/penalty.js';
import { ARROW, esc, plural } from './html.js';

const eur = (n) => `€${n}`;
const goals = (n) => `${n} ${plural(n, 'goal')}`;

export function lunaCard(s, day, cls = '') {
  const p = s.penalty;
  if (!p) return '';
  const due = owing(s, day);
  const owed = due.reduce((sum, w) => sum + w.amount, 0);
  const now = atStake(s, day);
  const link = revolutLink(p, owed);
  const who = esc(p.payee || 'Luna');
  let body;

  if (owed) {
    const lines = due.map((w) => `<li><b>Week ${isoWeek(w.monday).week}</b> · ${goals(w.missed.length)} missed: ${esc(w.missed.join(', '))} <span class="amt">${eur(w.amount)}</span></li>`).join('');
    body = `<div class="owe"><div class="big">${eur(owed)}</div><div class="who">to ${who}</div></div>
      <ul class="weeks">${lines}</ul>
      <div class="buttons">
        ${link ? `<a class="btn dark" href="${esc(link)}" target="_blank" rel="noopener">Pay ${eur(owed)} in Revolut ${ARROW}</a>`
    : `<span class="btn dark disabled">Pay ${eur(owed)} in Revolut</span>`}
        <button class="btn outline" data-act="paid">I’ve paid</button>
      </div>
      ${link ? '' : `<div class="gnote">${who}’s Revolut link isn’t set up yet.</div>`}`;
  } else {
    const lastKey = Object.keys(p.paid || {}).sort().pop();
    const last = lastKey ? p.paid[lastKey] : null;
    body = `<div class="owe"><div class="big ok">${eur(0)}</div><div class="who">owed to ${who}</div></div>
      <p class="desc">Settled up. ${last ? `Last paid ${eur(last.amount)} on ${shortLabel(last.day)} for week ${Number(lastKey.slice(6))}.` : 'Nothing paid yet.'}${
  last ? ` <button class="btn text inline" data-act="unpaid" data-id="${esc(lastKey)}">Undo</button>` : ''}</p>`;
  }

  let stake = '';
  if (now) {
    stake = now.missed.length
      ? `This week so far: ${goals(now.missed.length)} not met, ${eur(now.amount)} if it ended now (${esc(now.missed.join(', '))}).`
      : now.total ? 'This week so far: every goal on track, nothing to pay.' : 'This week has no goals yet, so nothing can be missed.';
  }
  return `
  <section class="card luna ${cls}">
    <div class="top"><h3>${who}’s jar</h3><div class="sub">${eur(p.euros)} per missed week goal</div></div>
    ${body}
    ${stake ? `<p class="desc stake">${stake}</p>` : ''}
  </section>`;
}
