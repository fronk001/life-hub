import { test, eq } from './harness.js';
import { byId, groceriesMonday, moneyWindow, rituals } from './fixtures.js';
import {
  activeDay, dueDay, history, minutesLeft, needsAttention, nextDue, opensDay, reviewWeeks, status,
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


// ---- the schedules of 29 Sep 2026 -----------------------------------------

test('a month-end window: opens on the 25th, due on the last day', () => {
  eq(opensDay(moneyWindow, '2026-10-10'), '2026-10-25');
  eq(dueDay(moneyWindow, '2026-10-10'), '2026-10-31');
  eq(dueDay(moneyWindow, '2027-02-03'), '2027-02-28');
  eq(opensDay(money, '2026-10-10'), null, 'the first-weekend rule has no window');
});

test('the money review through its window: due, due today, late, then next month', () => {
  const label = (day, runs = {}) => status(moneyWindow, runs, day).label;
  eq(label('2026-09-29'), 'Due Wed 30 Sep', 'September’s window is open the day it moved');
  eq(status(moneyWindow, {}, '2026-09-29').kind, 'due-soon');
  eq(label('2026-09-30'), 'Due today');
  eq(label('2026-10-01'), 'Overdue since Wed 30 Sep', 'missed: still open, and late');
  eq(label('2026-10-15'), 'Overdue since Wed 30 Sep');
  eq(label('2026-10-16'), '60 min', 'after two weeks it gives way to October');
  eq(label('2026-10-24'), '60 min');
  eq(label('2026-10-25'), 'Due Sat 31 Oct');
  eq(label('2026-10-01', { money: { '2026-09': { done: true, minutes: 50 } } }), '60 min', 'done in time: October next');
});

test('a late money review counts for the month it was due in', () => {
  eq(activeDay(moneyWindow, {}, '2026-10-03'), '2026-09-01');
  eq(nextDue(moneyWindow, {}, '2026-10-03'), '2026-09-30');
  const started = { money: { '2026-10': { startedAt: 1, steps: {} } } };
  eq(activeDay(moneyWindow, started, '2026-10-03'), '2026-10-03', 'unless October’s is already under way');
});

test('the phone shows the money review while its window is open, and while late', () => {
  eq(needsAttention(moneyWindow, {}, '2026-10-24'), false);
  eq(needsAttention(moneyWindow, {}, '2026-10-25'), true);
  eq(needsAttention(moneyWindow, {}, '2026-11-01'), true, 'October’s, late');
  eq(needsAttention(moneyWindow, {}, '2026-11-16'), false);
});

test('moving groceries to Mondays makes nothing overdue: the first Monday is 5 October', () => {
  eq(status(groceriesMonday, {}, '2026-09-29').label, 'On track', 'Monday 28 Sep was never a groceries day');
  eq(nextDue(groceriesMonday, {}, '2026-09-29'), '2026-10-05');
  eq(status(groceriesMonday, {}, '2026-10-05').label, 'Due today');
  eq(status(groceriesMonday, {}, '2026-10-06').label, 'Overdue since Mon 5 Oct');
  eq(status(groceriesMonday, {}, '2026-10-12').label, 'Due today', 'a new Monday: last week’s is dropped');
  const h = history(groceriesMonday, {}, '2026-10-14');
  eq([h[5].key, h[5].beforeStart], ['2026-W40', true], 'the week it moved reads as no data, not as a miss');
  eq([h[6].key, h[6].beforeStart], ['2026-W41', false]);
});

test('a Sunday review missed can still be done until Wednesday, for its own week', () => {
  eq(activeDay(review, {}, '2026-10-05'), '2026-09-28', 'Monday: last week’s review');
  eq(status(review, {}, '2026-10-05').label, 'Overdue since Sun 4 Oct');
  eq(reviewWeeks(review, {}, '2026-10-05'), { closes: '2026-09-28', plans: '2026-10-05' });
  eq(activeDay(review, {}, '2026-10-07'), '2026-09-28', 'Wednesday');
  eq(status(review, {}, '2026-10-08').label, '20 min', 'Thursday: this week’s');
  const done = { review: { '2026-W40': { done: true } } };
  eq(status(review, done, '2026-10-05').label, '20 min', 'done on time: nothing late');
  eq(reviewWeeks(review, {}, '2026-10-04'), { closes: '2026-09-28', plans: '2026-10-05' }, 'on the day');
});
