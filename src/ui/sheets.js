// The editors: goals for a week, month or year, and the plan of days for the
// weekly habits. Like the sign-in form (account.js) they live outside #app:
// the views are re-rendered whole on every change, including one arriving
// from another device, and that would wipe whatever is being typed.

import { dayName, isoWeek, monthKey, monthName, weekRangeLabel, yearKey } from '../core/dates.js';
import { goalsFor, periodName, periodOf } from '../core/goals.js';
import { freqLabel, planned, weeklyTarget } from '../core/habits.js';
import { act, get } from '../data/store.js';
import { esc, plural } from './html.js';

let box = null;
let opener = null;
let submit = null;

const newId = () => `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function build() {
  box = document.createElement('div');
  box.className = 'sheet';
  box.hidden = true;
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-labelledby', 'sheet-title');
  document.body.append(box);

  box.addEventListener('submit', (e) => {
    e.preventDefault();
    submit(e.target);
    closeSheet();
  });
  box.addEventListener('click', (e) => {
    const f = e.target.closest('[data-f]');
    if (!f) return;
    const k = f.dataset.f;
    if (k === 'cancel') closeSheet();
    else if (k === 'add') addGoal(f.closest('.gsec'));
    else if (k === 'remove') f.closest('.grow').remove();
    else if (k === 'day') {
      f.setAttribute('aria-pressed', String(f.getAttribute('aria-pressed') !== 'true'));
      countDays(f.closest('.prow'));
    }
  });
  box.addEventListener('change', (e) => {
    if (e.target.name === 'measure') e.target.closest('.grow').querySelector('.gpct').hidden = e.target.value !== 'manual';
  });
  box.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSheet();
  });
}

function show(html, onSubmit) {
  if (!box) build();
  opener = document.activeElement;
  submit = onSubmit;
  box.innerHTML = html;
  box.hidden = false;
  box.scrollTop = 0;
  box.querySelector('h1').focus();
}

export function closeSheet() {
  if (!box || box.hidden) return;
  box.hidden = true;
  box.innerHTML = '';
  submit = null;
  if (opener && opener.isConnected) opener.focus();
}

export const sheetOpen = () => !!box && !box.hidden;

const actions = (label) => `
  <div class="sheet-actions">
    <button class="btn dark" type="submit">${label}</button>
    <button type="button" class="btn text" data-f="cancel">Cancel</button>
  </div>`;

// ---- goals ------------------------------------------------------------------

function measureOptions(s, m) {
  const value = m.type === 'habit' ? `habit:${m.habitId}` : m.type === 'ritual' ? `ritual:${m.ritualId}` : 'manual';
  const opt = (v, label) => `<option value="${esc(v)}"${v === value ? ' selected' : ''}>${esc(label)}</option>`;
  const habits = s.habits.filter((h) => !h.archived);
  const rituals = s.rituals.filter((r) => !r.archived);
  const known = value === 'manual' || habits.some((h) => `habit:${h.id}` === value) || rituals.some((r) => `ritual:${r.id}` === value);
  return opt('manual', 'By hand, in %')
    + (habits.length ? `<optgroup label="Counts a habit’s ticks">${habits.map((h) => opt(`habit:${h.id}`, h.name)).join('')}</optgroup>` : '')
    + (rituals.length ? `<optgroup label="Counts a ritual">${rituals.map((r) => opt(`ritual:${r.id}`, r.name)).join('')}</optgroup>` : '')
    + (known ? '' : opt(value, 'A habit or ritual that’s gone'));
}

function goalRow(s, g) {
  const m = g.measure || { type: 'manual', pct: 0 };
  const manual = m.type === 'manual';
  return `
  <li class="grow" data-id="${esc(g.id)}">
    <input name="title" value="${esc(g.title)}" placeholder="A goal, in a few words" aria-label="Goal" autocomplete="off" maxlength="80">
    <div class="gmeta">
      <label class="gmeasure"><span>Progress</span><select name="measure">${measureOptions(s, m)}</select></label>
      <label class="gpct"${manual ? '' : ' hidden'}><input name="pct" type="number" min="0" max="100" step="5" inputmode="numeric" value="${manual ? Number(m.pct) || 0 : 0}" aria-label="Progress in percent"><span>%</span></label>
      <button type="button" class="gdel" data-f="remove">Remove</button>
    </div>
  </li>`;
}

function addGoal(sec) {
  const li = document.createElement('template');
  li.innerHTML = goalRow(get(), { id: newId(), title: '', measure: { type: 'manual', pct: 0 } }).trim();
  const row = li.content.firstChild;
  sec.querySelector('.glist').append(row);
  row.querySelector('[name=title]').focus();
}

// One level's goals for the period containing `day`. Goals carried over from
// an earlier period come in as copies with new ids: saving makes them this
// period's own, and the earlier period keeps its originals.
function section(s, level, day, many) {
  const period = periodOf(level, day);
  const { goals, carriedFrom } = goalsFor(s.goals, level, day);
  const rows = goals.map((g) => (carriedFrom ? { ...g, id: newId() } : g));
  return `
  <section class="gsec" data-level="${level}" data-period="${esc(period)}">
    ${many ? `<h2>${esc(periodName(level, period))}</h2>` : ''}
    ${carriedFrom ? `<p class="gfrom">These are ${esc(periodName(level, carriedFrom))}’s. Keep them, change them or remove them.</p>` : ''}
    <ul class="glist">${rows.map((g) => goalRow(s, g)).join('')}</ul>
    <button type="button" class="btn text gadd" data-f="add">+ Add a goal</button>
  </section>`;
}

function readSection(sec) {
  return [...sec.querySelectorAll('.grow')].map((li) => {
    const [type, id] = li.querySelector('[name=measure]').value.split(':');
    const measure = type === 'habit' ? { type, habitId: id }
      : type === 'ritual' ? { type, ritualId: id }
        : { type: 'manual', pct: Number(li.querySelector('[name=pct]').value) };
    return { id: li.dataset.id, title: li.querySelector('[name=title]').value, measure };
  });
}

function goalsTitle(levels, day) {
  const name = { week: () => `week ${isoWeek(day).week}`, month: () => monthName(monthKey(day)), year: () => yearKey(day) };
  return `Goals for ${levels.map((l) => name[l]()).join(' and ')}`;
}

// The goal editor for the periods containing `day`, one section per level.
// `onSave` runs after saving (the weekly review ticks its step with it).
export function editGoals({ levels, day, onSave = null }) {
  const s = get();
  show(`
  <form class="sheet-card" novalidate>
    <div class="eyebrow">Goals</div>
    <h1 id="sheet-title" tabindex="-1">${esc(goalsTitle(levels, day))}</h1>
    <p class="lead">${levels.includes('week') ? `${esc(weekRangeLabel(day))}. ` : ''}A goal linked to a habit or ritual counts itself; one kept by hand shows the percentage you give it.</p>
    ${levels.map((l) => section(s, l, day, levels.length > 1)).join('')}
    ${actions('Save goals')}
  </form>`, (form) => {
    for (const sec of form.querySelectorAll('.gsec')) act.saveGoals(sec.dataset.level, sec.dataset.period, readSection(sec));
    if (onSave) onSave();
  });
}

// ---- the plan of days -------------------------------------------------------

const countText = (n, target) => (n ? `${n} ${plural(n, 'day')} for ${target}× a week` : 'Any day');

function countDays(row) {
  const n = row.querySelectorAll('.day[aria-pressed=true]').length;
  const out = row.querySelector('.pcount');
  out.textContent = countText(n, Number(row.dataset.target));
  out.classList.toggle('short', n > 0 && n < Number(row.dataset.target));
}

function planRow(h) {
  const on = new Set(planned(h));
  const target = weeklyTarget(h);
  const days = [1, 2, 3, 4, 5, 6, 7].map((d) => `<button type="button" class="day" data-f="day" data-wd="${d}" aria-pressed="${on.has(d)}" aria-label="${dayName(d)}">${dayName(d).slice(0, 2)}</button>`).join('');
  return `
  <div class="prow" data-id="${esc(h.id)}" data-target="${target}">
    <div class="ptop"><span class="pname">${esc(h.name)} <span class="hint">${esc(freqLabel(h))}</span></span><span class="pcount${on.size && on.size < target ? ' short' : ''}">${countText(on.size, target)}</span></div>
    <div class="days" role="group" aria-label="${esc(h.name)}">${days}</div>
  </div>`;
}

// The weekly habits' planned days. A planned habit shows as due on its days
// (until the week's quota is met); a tick on any other day still counts.
export function planDays({ onSave = null } = {}) {
  const habits = get().habits.filter((h) => !h.archived && h.freq.type === 'weekly');
  show(`
  <form class="sheet-card" novalidate>
    <div class="eyebrow">Weekly review</div>
    <h1 id="sheet-title" tabindex="-1">Plan the days</h1>
    <p class="lead">Pick the days you mean to go. On those days the habit shows as due; a session on another day still counts. The plan stays until you change it.</p>
    <div class="plist">${habits.map(planRow).join('') || '<p class="lead">No weekly habits to plan.</p>'}</div>
    ${actions('Save plan')}
  </form>`, (form) => {
    const plan = {};
    for (const row of form.querySelectorAll('.prow')) {
      plan[row.dataset.id] = [...row.querySelectorAll('.day[aria-pressed=true]')].map((b) => Number(b.dataset.wd));
    }
    act.setPlannedDays(plan);
    if (onSave) onSave();
  });
}
