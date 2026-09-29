// The desktop dashboard (mockup 1): header, week grid + Mongolian card,
// rituals, goals, and last month's wins.

import {
  addMonths, daysInMonth, isoWeek, longLabel, monthKey, monthName, shortLabel, weekDays,
  weekRangeLabel, weekdayName, yearKey,
} from '../core/dates.js';
import { habitSub, isDone, streak, todaySummary, weekCount, weekHistory, weeklyTarget } from '../core/habits.js';
import { activeRun, history, lastRunDay, nextDue, progress, status } from '../core/rituals.js';
import { goalsFor, measure, periodName } from '../core/goals.js';
import { monthWins } from '../core/wins.js';
import { CHECK, esc, launchLink, launcher, launcherVisible, plural } from './html.js';
import { lunaCard } from './luna.js';
import { stepButton } from './steps.js';

const days = (n) => plural(n, 'day');

function header(s, habits, featured, day) {
  const sum = todaySummary(s.checks, habits, day);
  const wins = monthWins(s, monthKey(day));
  const stat = (k, v, cls = '') => `<div class="stat"><div class="k">${k}</div><div class="v ${cls}">${v}</div></div>`;
  const st = featured ? streak(s.checks, featured.id, day).current : 0;
  return `
  <header class="head">
    <div class="titles">
      <div class="eyebrow">Life Hub · Week ${isoWeek(day).week}</div>
      <h1>${longLabel(day)}</h1>
      <div class="tagline">Small things every day. Big things on purpose.</div>
    </div>
    <div class="stats">
      ${stat('Done today', `${sum.done} <small>/ ${sum.total}</small>`)}
      ${featured ? stat(`${esc(featured.short || featured.name)} streak`, `${st} <small>${days(st)}</small>`, 'green') : ''}
      ${stat(`Wins in ${monthName(monthKey(day))}`, wins.total)}
    </div>
  </header>`;
}

function habitRow(s, h, day) {
  const cells = weekDays(day).map((d) => {
    if (d > day) return '<div class="cell future"></div>';
    if (h.createdDay && d < h.createdDay) return '<div class="cell before"></div>';
    const done = isDone(s.checks, d, h.id);
    return `<button class="cell${d === day ? ' today' : ''}${done ? ' done' : ''}" data-act="habit" data-id="${esc(h.id)}" data-day="${d}" aria-pressed="${done}" aria-label="${esc(h.name)}, ${longLabel(d)}">${done ? CHECK : ''}</button>`;
  }).join('');
  const count = weekCount(s.checks, h, day);
  const target = weeklyTarget(h);
  const hist = weekHistory(s.checks, h, day).map((w) => (w.beforeStart
    ? '<span class="chip none" title="Before Life Hub">—</span>'
    : `<span class="chip ${w.met ? 'full' : 'part'}">${w.count}/${w.target}</span>`)).join('');
  return `
    <div class="hgrid row">
      <div><div class="hname">${esc(h.name)}</div><div class="hsub">${esc(habitSub(h))}</div></div>
      ${cells}
      <div class="wk${count >= target ? ' met' : ''}">${count} / ${target}</div>
      <div class="hist">${hist}</div>
    </div>`;
}

function habitsCard(s, habits, day) {
  const heads = weekDays(day).map((d) => `<div class="c${d === day ? ' today-col' : ''}">${weekdayName(d)[0]}</div>`).join('');
  return `
  <section class="card habits">
    <div class="section-head">
      <h2>Habits this week</h2>
      <div class="muted">${weekRangeLabel(day)} · tap today’s square to check in</div>
    </div>
    <div class="hgrid header"><div>Habit</div>${heads}<div class="r">Week</div><div class="hist-h">Last 4 weeks</div></div>
    ${habits.map((h) => habitRow(s, h, day)).join('')}
  </section>`;
}

function featureCard(s, h, day, phone) {
  const f = h.featured;
  const { current, longest } = streak(s.checks, h.id, day);
  const done = isDone(s.checks, day, h.id);
  const l = launcher(s, h.launcherId);
  return `
  <section class="feature">
    <div class="badge">Non-negotiable</div>
    <h2>${esc(f.title || h.name)}</h2>
    <p>${esc(f.blurb || '')}</p>
    <div class="streakbox">
      <div class="k">Streak</div>
      <div class="v">${current} ${days(current)}</div>
      <div class="n">Longest: ${longest} ${days(longest)}${f.note ? ` · ${esc(f.note)}` : ''}</div>
    </div>
    <div class="actions">
      ${launcherVisible(l, phone) ? launchLink(l, 'btn light', l.label, { phone }) : ''}
      <button class="btn ghost-light${done ? ' on' : ''}" data-act="habit" data-id="${esc(h.id)}" data-day="${day}" aria-pressed="${done}">${done ? 'Done for today' : esc(f.doneLabel || 'Mark done')}</button>
    </div>
  </section>`;
}

function pillClass(st) {
  if (st.kind === 'done') return 'green';
  if (st.kind === 'overdue') return 'red';
  if (st.kind === 'on-track') return st.neutral ? 'neutral' : 'green';
  return 'amber';
}

function ritualCard(s, r, day, phone) {
  const st = status(r, s.runs, day);
  const run = activeRun(s.runs, r, day);
  const steps = r.steps || [];
  const started = !!(run && (run.startedAt || run.done));
  const monthly = r.schedule.type === 'monthly';
  let body = r.description ? `<p class="desc">${esc(r.description)}</p>` : '';

  if (!steps.length) {
    const last = lastRunDay(r, s.runs);
    body += `<p class="desc">${last ? `Last run ${shortLabel(last)}.` : 'No runs yet.'} Next run ${shortLabel(nextDue(r, s.runs, day))}.</p>`;
    const sq = history(r, s.runs, day).map((p) => {
      const cls = p.done ? 'done' : p.beforeStart ? 'before' : p.current ? 'pending' : '';
      return `<div class="sq ${cls}" title="${esc(p.key)}"></div>`;
    }).join('');
    body += `<div class="histwrap"><div class="k">Last 8 ${monthly ? 'months' : 'weeks'}</div><div class="squares">${sq}</div></div>`;
  } else if (r.startLabel && !started) {
    body += `<ol class="plan">${steps.map((x) => `<li>${esc(x.label)}</li>`).join('')}</ol>`;
  } else {
    const p = progress(r, run);
    const w = p.total ? Math.max((p.done / p.total) * 100, 1) : 1;
    body += `<div class="progress"><div class="bar"><i style="width:${w}%"></i></div><div class="pv">${p.done} of ${p.total}</div></div>`;
    body += `<div class="steps">${steps.map((x) => stepButton(s, r, x, run, day)).join('')}</div>`;
  }

  const links = (r.launcherIds || []).map((id) => launcher(s, id)).filter((l) => launcherVisible(l, phone));
  let buttons = links.map((l) => launchLink(l, 'btn outline', l.label, { phone, ritualId: r.id })).join('');
  if (r.startLabel && !started) buttons += `<button class="btn dark" data-act="start" data-id="${esc(r.id)}">${esc(r.startLabel)}</button>`;
  const doneToggle = steps.length ? '' : `<button class="btn text" data-act="ritual-done" data-id="${esc(r.id)}">${
    run && run.done ? 'Done ✓ · undo' : `Mark this ${monthly ? 'month' : 'week'} done`}</button>`;

  return `
  <section class="card ritual">
    <div class="top"><div class="eyebrow">${esc(r.scheduleLabel || '')}</div><span class="pill ${pillClass(st)}">${esc(st.label)}</span></div>
    <h3>${esc(r.name)}</h3>
    ${body}
    ${buttons || doneToggle ? `<div class="buttons">${buttons}</div>${doneToggle}` : ''}
  </section>`;
}

const EDIT_NOUN = { week: 'this week’s', month: 'this month’s', year: 'this year’s' };

function goalCard(s, level, day) {
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

function winsFooter(s, day) {
  const prev = addMonths(monthKey(day), -1);
  const w = monthWins(s, prev);
  const chips = w.items.length
    ? w.items.map((i) => `<span class="chip ${i.tone === 'amber' ? 'part' : 'full'}">${esc(i.label)}</span>`).join('')
    : `<span class="muted">Nothing recorded in ${monthName(prev)}. Life Hub keeps count from here on.</span>`;
  return `<section class="card wins"><h2>${monthName(prev)}, done</h2><div class="chips">${chips}</div></section>`;
}

export function renderDesktop({ s, day, phone, footer = '', sync = '' }) {
  const habits = s.habits.filter((h) => !h.archived);
  const featured = habits.find((h) => h.featured);
  const rituals = s.rituals.filter((r) => !r.archived);
  return `
  <div class="desk">
    ${sync}
    ${header(s, habits, featured, day)}
    <div class="row1">
      ${habitsCard(s, habits, day)}
      ${featured ? featureCard(s, featured, day, phone) : ''}
    </div>
    <div class="block">
      <div class="section-head"><h2>Rituals</h2><div class="muted">Recurring sessions, each one a button away from the tool that does the work</div></div>
      <div class="grid3">${rituals.map((r) => ritualCard(s, r, day, phone)).join('')}</div>
    </div>
    <div class="block">
      <div class="section-head"><h2>What I’m working towards</h2><div class="muted">Every habit and ritual feeds a goal</div></div>
      <div class="grid3">${['week', 'month', 'year'].map((l) => goalCard(s, l, day)).join('')}</div>
    </div>
    ${lunaCard(s, day)}
    ${winsFooter(s, day)}
    ${footer}
  </div>`;
}
