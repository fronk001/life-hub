// The phone check-in (mockup 2): one tap per habit, the Mongolian card on
// top, any ritual that needs attention, and the week so far.

import { shortLabel } from '../core/dates.js';
import { isDone, phoneHint, streak, todaySummary, weekCount, weeklyTarget } from '../core/habits.js';
import { activeRun, dueWords, minutesLeft, needsAttention, progress, status } from '../core/rituals.js';
import { CHECK, CHECK_SM, esc, launchLink, launcher, launcherVisible } from './html.js';

function headline({ done, total }) {
  if (done === 0) return 'Nothing ticked yet';
  if (done >= total) return 'All done today';
  return `${done} of ${total} done`;
}

function featureCard(s, h, day, phone) {
  const f = h.featured;
  const done = isDone(s.checks, day, h.id);
  const l = launcher(s, h.launcherId);
  return `
  <section class="ph-feature">
    <div class="top"><div class="t">${esc(f.phoneTitle || h.name)}</div><div class="s">${streak(s.checks, h.id, day).current}-day streak</div></div>
    <div class="row">
      ${launcherVisible(l, phone) ? launchLink(l, 'btn light', l.short || l.label, { phone }) : ''}
      <button class="btn ghost-light${done ? ' on' : ''}" data-act="habit" data-id="${esc(h.id)}" data-day="${day}" aria-pressed="${done}">${done ? 'Done' : 'Mark done'}</button>
    </div>
  </section>`;
}

function habitRow(s, h, day) {
  const done = isDone(s.checks, day, h.id);
  return `
  <button class="ph-row${done ? ' on' : ''}" data-act="habit" data-id="${esc(h.id)}" data-day="${day}" aria-pressed="${done}">
    <span class="box">${done ? CHECK : ''}</span>
    <span class="main"><span class="n">${esc(h.name)}</span><span class="s">${esc(phoneHint(s.checks, h, day))}</span></span>
    <span class="c">${weekCount(s.checks, h, day)}/${weeklyTarget(h)}</span>
  </button>`;
}

function ritualBanner(s, r, day, phone, open) {
  const st = status(r, s.runs, day);
  const run = activeRun(s.runs, r, day);
  const steps = r.steps || [];
  let line;
  if (steps.length) {
    const p = progress(r, run);
    const left = minutesLeft(r, run);
    line = `${p.done} of ${p.total} steps done${left ? ` · about ${left} min left` : ''}`;
  } else {
    line = `Due ${shortLabel(st.due)} · tap to open`;
  }
  let body = '';
  if (open) {
    const stepsHtml = steps.map((x) => {
      const on = !!(run && run.steps && run.steps[x.id]);
      return `<button class="step${on ? ' on' : ''}" data-act="step" data-id="${esc(r.id)}" data-step="${esc(x.id)}" aria-pressed="${on}"><span class="box">${on ? CHECK_SM : ''}</span><span class="label">${esc(x.label)}${x.hint ? ` <span class="hint">(${esc(x.hint)})</span>` : ''}</span></button>`;
    }).join('');
    const links = (r.launcherIds || []).map((id) => launcher(s, id)).filter((l) => launcherVisible(l, phone))
      .map((l) => launchLink(l, 'btn outline', l.short || l.label, { phone, ritualId: r.id })).join('');
    const doneBtn = steps.length ? '' : `<button class="btn outline" data-act="ritual-done" data-id="${esc(r.id)}">${run && run.done ? 'Undo' : 'Mark done'}</button>`;
    body = `<div class="ph-ritual-body">${stepsHtml ? `<div class="steps">${stepsHtml}</div>` : ''}${links || doneBtn ? `<div class="buttons">${links}${doneBtn}</div>` : ''}</div>`;
  }
  return `
  <section class="ph-ritual${st.kind === 'overdue' ? ' overdue' : ''}">
    <button class="ph-ritual-head" data-act="expand" data-id="${esc(r.id)}" aria-expanded="${open}">
      <span class="t">${esc(r.name)} ${dueWords(st)}</span><span class="s">${line}</span>
    </button>
    ${body}
  </section>`;
}

export function renderPhone({ s, day, phone, ui, footer = '', sync = '' }) {
  const habits = s.habits.filter((h) => !h.archived);
  const featured = habits.find((h) => h.featured);
  const rest = habits.filter((h) => h !== featured);
  const urgent = s.rituals.filter((r) => !r.archived && needsAttention(r, s.runs, day));
  const tiles = habits.map((h) => `<div class="tile"><div class="v">${weekCount(s.checks, h, day)}/${weeklyTarget(h)}</div><div class="l">${esc(h.short || h.name)}</div></div>`).join('');
  return `
  <div class="ph">
    ${sync}
    <div class="ph-head">
      <div class="eyebrow">${shortLabel(day)} · Check-in</div>
      <h1>${headline(todaySummary(s.checks, habits, day))}</h1>
    </div>
    ${featured ? featureCard(s, featured, day, phone) : ''}
    <div class="ph-list">${rest.map((h) => habitRow(s, h, day)).join('')}</div>
    ${urgent.map((r) => ritualBanner(s, r, day, phone, ui.expanded.has(r.id))).join('')}
    <div class="ph-week">
      <div class="k">This week so far</div>
      <div class="tiles">${tiles}</div>
    </div>
    ${footer}
  </div>`;
}
