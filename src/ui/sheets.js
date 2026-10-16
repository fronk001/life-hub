// The editors: goals for a week, month or year, the habits and their quotas,
// and the plan of days for the weekly habits. Like the sign-in form (account.js) they live outside #app:
// the views are re-rendered whole on every change, including one arriving
// from another device, and that would wipe whatever is being typed.

import { dayMonth, dayName, isoWeek, monthKey, monthName, weekRangeLabel, yearKey } from '../core/dates.js';
import { goalsFor, periodName, periodOf } from '../core/goals.js';
import { freqLabel, freqText, planned, weeklyTarget } from '../core/habits.js';
import { act, get } from '../data/store.js';
import { esc, plural } from './html.js';

let box = null;
let opener = null;
let submit = null;

const newId = (p = 'g') => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

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
    else if (k === 'remove') f.closest('.grow, .hrow').remove();
    else if (k === 'add-habit') addHabitRow(f.closest('form'));
    else if (k === 'day') {
      f.setAttribute('aria-pressed', String(f.getAttribute('aria-pressed') !== 'true'));
      countDays(f.closest('.prow'));
    }
  });
  box.addEventListener('change', (e) => {
    if (e.target.name === 'measure') showFields(e.target.closest('.grow'));
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

// ---- habit quotas ------------------------------------------------------------

const FREQS = [{ type: 'daily' }, ...[1, 2, 3, 4, 5, 6].map((times) => ({ type: 'weekly', times }))];
const freqValue = (f) => (f.type === 'daily' ? 'daily' : `weekly:${f.times}`);
const readFreq = (v) => (v === 'daily' ? { type: 'daily' } : { type: 'weekly', times: Number(v.split(':')[1]) });

function freqSelect(freq, label) {
  const on = freqValue(freq);
  return `<select name="freq" aria-label="${esc(label)}">${FREQS.map((f) => `<option value="${freqValue(f)}"${freqValue(f) === on ? ' selected' : ''}>${f.type === 'daily' ? 'Every day' : freqText(f)}</option>`).join('')}</select>`;
}

// ---- goals ------------------------------------------------------------------

function measureValue(m) {
  if (m.type === 'habit') return `habit:${m.habitId}`;
  if (m.type === 'ritual') return `ritual:${m.ritualId}`;
  return m.type === 'count' ? 'count' : 'manual';
}

function measureOptions(s, m) {
  const value = measureValue(m);
  const opt = (v, label) => `<option value="${esc(v)}"${v === value ? ' selected' : ''}>${esc(label)}</option>`;
  const habits = s.habits.filter((h) => !h.archived);
  const rituals = s.rituals.filter((r) => !r.archived);
  const known = ['manual', 'count'].includes(value) || habits.some((h) => `habit:${h.id}` === value) || rituals.some((r) => `ritual:${r.id}` === value);
  return opt('manual', 'By hand, in %')
    + opt('count', 'Count up to a target (+1 each time)')
    + `<optgroup label="Counts a habit’s ticks">${habits.map((h) => opt(`habit:${h.id}`, h.name)).join('')}${opt('new-habit', 'A new habit…')}</optgroup>`
    + (rituals.length ? `<optgroup label="Counts a ritual">${rituals.map((r) => opt(`ritual:${r.id}`, r.name)).join('')}</optgroup>` : '')
    + (known ? '' : opt(value, 'A habit or ritual that’s gone'));
}

// Which inputs a row shows depends on how the goal is measured.
function showFields(li) {
  const v = li.querySelector('[name=measure]').value;
  const counted = v === 'count';
  li.querySelector('.gpct').hidden = v !== 'manual';
  li.querySelector('.gtarget').hidden = !(counted || v.startsWith('habit:') || v === 'new-habit');
  li.querySelector('.gtarget span').textContent = counted ? 'Target' : 'Own target';
  li.querySelector('[name=target]').placeholder = counted ? '' : 'usual';
  li.querySelector('.gnew').hidden = v !== 'new-habit';
}

function logList(g) {
  const log = g.log || [];
  if (!log.length) return '';
  const unit = g.measure.type === 'manual' ? '%' : '';
  const items = log.slice(-12).reverse().map((e) => `<li><span>${esc(dayMonth(e.day))}</span><span>${Number(e.v)}${unit}</span></li>`).join('');
  return `<details class="glog"><summary>Progress so far</summary><ol>${items}</ol></details>`;
}

function goalRow(s, g) {
  const m = g.measure || { type: 'manual', pct: 0 };
  const manual = m.type === 'manual';
  const counted = m.type === 'count';
  const targeted = counted || m.type === 'habit';
  return `
  <li class="grow" data-id="${esc(g.id)}">
    <input name="title" value="${esc(g.title)}" placeholder="A goal, in a few words" aria-label="Goal" autocomplete="off" maxlength="80">
    <div class="gmeta">
      <label class="gmeasure"><span>Progress</span><select name="measure">${measureOptions(s, m)}</select></label>
      <label class="gpct"${manual ? '' : ' hidden'}><input name="pct" type="number" min="0" max="100" step="5" inputmode="numeric" value="${manual ? Number(m.pct) || 0 : 0}" aria-label="Progress in percent"><span>%</span></label>
      <label class="gtarget"${targeted ? '' : ' hidden'}><span>${counted ? 'Target' : 'Own target'}</span><input name="target" type="number" min="1" step="1" inputmode="numeric" value="${targeted ? Number(m.target) || '' : ''}" placeholder="${counted ? '' : 'usual'}"></label>
      <button type="button" class="gdel" data-f="remove">Remove</button>
    </div>
    <div class="gnew" hidden>
      <input name="hname" placeholder="The habit’s name" aria-label="New habit’s name" autocomplete="off" maxlength="40">
      ${freqSelect({ type: 'weekly', times: 3 }, 'How often')}
    </div>
    ${logList(g)}
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

// A row set to "A new habit…" adds that habit (to `born`, created before the
// goals are saved) and links the goal to it.
function readSection(sec, born) {
  return [...sec.querySelectorAll('.grow')].map((li) => {
    const title = li.querySelector('[name=title]').value;
    const [type, id] = li.querySelector('[name=measure]').value.split(':');
    const target = Number(li.querySelector('[name=target]').value) || 0;
    let measure;
    if (type === 'new-habit') {
      const name = li.querySelector('[name=hname]').value.trim() || title.trim();
      if (!title.trim()) return { id: li.dataset.id, title: '' };
      const habitId = newId('h');
      born.push({ habit: { id: habitId, name }, freq: readFreq(li.querySelector('.gnew [name=freq]').value) });
      measure = { type: 'habit', habitId, target };
    } else if (type === 'habit') measure = { type, habitId: id, target };
    else if (type === 'ritual') measure = { type, ritualId: id };
    else if (type === 'count') measure = { type, target: target || 1 };
    else measure = { type: 'manual', pct: Number(li.querySelector('[name=pct]').value) };
    return { id: li.dataset.id, title, measure };
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
    <p class="lead">${levels.includes('week') ? `${esc(weekRangeLabel(day))}. ` : ''}A goal linked to a habit or ritual counts itself. One kept by hand shows the percentage you give it; a counted one goes up by one each time you tap +1. Something new to keep up? Pick “A new habit…”.</p>
    ${levels.map((l) => section(s, l, day, levels.length > 1)).join('')}
    ${actions('Save goals')}
  </form>`, (form) => {
    const born = [];
    const sections = [...form.querySelectorAll('.gsec')].map((sec) => [sec.dataset.level, sec.dataset.period, readSection(sec, born)]);
    for (const h of born) act.addHabit(h.habit, h.freq);
    for (const [level, period, goals] of sections) act.saveGoals(level, period, goals);
    if (onSave) onSave();
  });
}

// ---- habits -----------------------------------------------------------------

function habitRow(h) {
  return `
  <div class="hrow" data-id="${esc(h.id)}">
    <span class="pname">${esc(h.name)}</span>
    ${freqSelect(h.freq, `How often: ${h.name}`)}
  </div>`;
}

function addHabitRow(form) {
  const t = document.createElement('template');
  t.innerHTML = `
  <div class="hrow new">
    <input name="hname" placeholder="A new habit’s name" aria-label="New habit’s name" autocomplete="off" maxlength="40">
    ${freqSelect({ type: 'weekly', times: 3 }, 'How often')}
    <button type="button" class="gdel" data-f="remove">Remove</button>
  </div>`.trim();
  const row = t.content.firstChild;
  form.querySelector('.hlist').append(row);
  row.querySelector('input').focus();
}

// How often each habit is meant to happen, and new habits. A changed quota
// counts from this week's Monday; the weeks before keep the one they had.
export function editHabits() {
  const habits = get().habits.filter((h) => !h.archived);
  show(`
  <form class="sheet-card" novalidate>
    <div class="eyebrow">Habits</div>
    <h1 id="sheet-title" tabindex="-1">How often</h1>
    <p class="lead">A new quota counts from this Monday; earlier weeks keep the one they had. A new habit starts today.</p>
    <div class="hlist">${habits.map(habitRow).join('')}</div>
    <button type="button" class="btn text gadd" data-f="add-habit">+ Add a habit</button>
    ${actions('Save habits')}
  </form>`, (form) => {
    const freqs = {};
    for (const row of form.querySelectorAll('.hrow:not(.new)')) freqs[row.dataset.id] = readFreq(row.querySelector('[name=freq]').value);
    act.setHabitFreqs(freqs);
    for (const row of form.querySelectorAll('.hrow.new')) {
      const name = row.querySelector('[name=hname]').value.trim();
      if (name) act.addHabit({ id: newId('h'), name }, readFreq(row.querySelector('[name=freq]').value));
    }
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
