import { test, eq } from './harness.js';
import { rituals, byId } from './fixtures.js';
import {
  activeDay, dueDay, history, minutesLeft, needsAttention, nextDue, status,
} from '../src/core/rituals.js';

const groceries = byId(rituals, 'groceries');
const money = byId(rituals, 'money');
const review = byId(rituals, 'review');

test('due days', () => {
  eq(dueDay(groceries, '2026-10-01'), '2026-10-04');
  eq(dueDay(money, '2026-10-20'), '2026-10-04');
});

test('a monthly ritual created after this month\'s due day is due next month, not overdue', () => {
  eq(activeDay(money, {}, '2026-09-28'), '2026-10-01');
  eq(status(money, {}, '2026-09-28').label, 'Due Sun 4 Oct');
});

test('status pills as in the mockup (Thursday 1 October)', () => {
  eq(status(groceries, {}, '2026-10-01').label, 'On track');
  eq(status(money, {}, '2026-10-01').label, 'Due Sun 4 Oct');
  eq(status(money, {}, '2026-10-01').kind, 'due-soon');
  eq(status(review, {}, '2026-10-01').label, '20 min');
});

test('due today, overdue, done', () => {
  eq(status(groceries, {}, '2026-10-04').kind, 'due-today');
  eq(status(money, {}, '2026-10-06').label, 'Overdue since Sun 4 Oct');
  const runs = { money: { '2026-10': { done: true, minutes: 52 } } };
  eq(status(money, runs, '2026-10-06').label, 'Done · 52 min');
});

test('the phone nags about monthly rituals 3 days ahead, weekly ones only on the day', () => {
  eq(needsAttention(money, {}, '2026-10-01'), true);
  eq(needsAttention(money, {}, '2026-09-30'), false);
  eq(needsAttention(groceries, {}, '2026-10-01'), false);
  eq(needsAttention(groceries, {}, '2026-10-04'), true);
  eq(needsAttention(review, { review: { '2026-W40': { startedAt: 1, steps: {} } } }, '2026-10-01'), true, 'started');
});

test('minutes left scales with the checklist', () => {
  eq(minutesLeft(money, null), 60);
  eq(minutesLeft(money, { steps: { numbers: true } }), 40);
});

test('history: 8 periods ending with the current one', () => {
  const runs = { groceries: { '2026-W41': { done: true, doneDay: '2026-10-11' } } };
  const h = history(groceries, runs, '2026-10-14');
  eq(h.length, 8);
  eq(h[7], { key: '2026-W42', done: false, current: true, beforeStart: false });
  eq(h[6].done, true);
  eq(h[5].beforeStart, false, 'week 40 is the week it was created');
  eq(h[4].beforeStart, true);
});

test('next due moves on once this period is done', () => {
  eq(nextDue(groceries, {}, '2026-10-01'), '2026-10-04');
  const runs = { groceries: { '2026-W40': { done: true, doneDay: '2026-10-01' } } };
  eq(nextDue(groceries, runs, '2026-10-01'), '2026-10-11');
});

