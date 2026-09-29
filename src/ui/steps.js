// A ritual's checklist, on both views: a tick box per step. The weekly
// review's steps also do what they say: a step with `does` gets a line under
// its box, with the week's score or a button that opens the screen for that
// step (sheets.js), where saving ticks the step too.
//
// The review closes the week of its run and plans the week after, so a review
// done late, on Monday, still scores last week and plans this one.

import { addDays, isoWeek, monthKey, monthName, yearKey } from '../core/dates.js';
import { goalsFor } from '../core/goals.js';
import { planDays, planned, weekCount, weeklyTarget } from '../core/habits.js';
import { reviewWeeks } from '../core/rituals.js';
import { CHECK_SM, esc } from './html.js';

// Habits that existed during the week being closed, and how each did.
export function weekScore(s, closes) {
  const end = addDays(closes, 6);
  return s.habits.filter((h) => !h.archived && !(h.createdDay && h.createdDay > end)).map((h) => {
    const count = weekCount(s.checks, h, closes);
    const target = weeklyTarget(h);
    return { h, count, target, met: count >= target };
  });
}

function stepExtra(s, r, step, day) {
  if (!step.does) return '';
  const { closes, plans } = reviewWeeks(r, s.runs, day);
  const button = (label) => `<button class="do" data-act="do" data-does="${esc(step.does)}" data-id="${esc(r.id)}" data-step="${esc(step.id)}">${label}</button>`;
  const note = (text) => (text ? `<span class="do-note">${text}</span>` : '');
  let body = '';

  if (step.does === 'score') {
    const rows = weekScore(s, closes);
    body = note(`${rows.filter((x) => x.met).length} of ${rows.length} hit`) + rows.map((x) =>
      `<span class="chip ${x.met ? 'full' : 'part'}">${esc(x.h.short || x.h.name)} ${x.count}/${x.target}</span>`).join('');
  } else if (step.does === 'week-goals') {
    const { goals, carriedFrom } = goalsFor(s.goals, 'week', plans);
    body = button(`Set week ${isoWeek(plans).week} goals`) + note(carriedFrom ? '' : goals.map((g) => esc(g.title)).join(' · '));
  } else if (step.does === 'plan') {
    const plan = s.habits.filter((h) => !h.archived && h.freq.type === 'weekly' && planned(h).length)
      .map((h) => `${esc(h.short || h.name)} ${esc(planDays(h))}`);
    body = button('Plan the days') + note(plan.join(' · '));
  } else if (step.does === 'check-goals') {
    body = button(`Check ${monthName(monthKey(plans))} and ${yearKey(plans)}`);
  }
  return body ? `<div class="step-do">${body}</div>` : '';
}

export function stepButton(s, r, step, run, day) {
  const on = !!(run && run.steps && run.steps[step.id]);
  return `<button class="step${on ? ' on' : ''}" data-act="step" data-id="${esc(r.id)}" data-step="${esc(step.id)}" aria-pressed="${on}">
    <span class="box">${on ? CHECK_SM : ''}</span><span class="label">${esc(step.label)}${step.hint ? ` <span class="hint">(${esc(step.hint)})</span>` : ''}</span>
  </button>${stepExtra(s, r, step, day)}`;
}
