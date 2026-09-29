// A goal card (week / month / year): the goals with their progress bars.
// Shared by the desktop dashboard and the phone.

import { daysInMonth, isoWeek, monthKey, monthName, yearKey } from '../core/dates.js';
import { goalsFor, measure, periodName } from '../core/goals.js';
import { esc } from './html.js';

const EDIT_NOUN = { week: 'this week’s', month: 'this month’s', year: 'this year’s' };

export function goalCard(s, level, day) {
  const { goals, carriedFrom } = goalsFor(s.goals, level, day);
  const head = {
    week: ['This week', `Week ${isoWeek(day).week}`],
    month: [monthName(monthKey(day)), `Day ${Number(day.slice(8))} of ${daysInMonth(monthKey(day))}`],
    year: [yearKey(day), 'From the vision board'],
  }[level];
  const rows = goals.map((g) => {
    const m = measure(g, s, day);
    const val = m.manual
      ? `<button class="val" data-act="goal" data-id="${esc(g.id)}" data-title="${esc(g.title)}" data-pct="${Math.round(m.value * 100)}" title="Tap to update">${m.label}</button>`
      : `<span class="val">${m.label}</span>`;
    return `<div class="goal"><div class="top"><span>${esc(g.title)}</span>${val}</div><div class="bar"><i style="width:${Math.max(m.value * 100, 1)}%"></i></div>${
      m.note ? `<div class="gnote">${esc(m.note)}</div>` : ''}</div>`;
  }).join('');
  return `
  <section class="card goal-card ${level}">
    <div class="top"><h3>${head[0]}</h3><div class="sub">${head[1]}</div></div>
    ${rows || '<p class="desc">No goals yet.</p>'}
    ${carriedFrom ? `<div class="carried">Carried over from ${periodName(level, carriedFrom)}.</div>` : ''}
    <button class="btn text" data-act="goals" data-level="${level}">${rows && !carriedFrom ? 'Edit goals' : `Set ${EDIT_NOUN[level]} goals`}</button>
  </section>`;
}
