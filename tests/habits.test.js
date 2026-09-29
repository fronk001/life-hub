import { test, eq } from './harness.js';
import { habits, byId, ticks } from './fixtures.js';
import {
  habitSub, inPlayToday, phoneHint, streak, todaySummary, weekCount, weekHistory,
} from '../src/core/habits.js';

const mn = byId(habits, 'mn');
const gym = byId(habits, 'gym');
const ride = byId(habits, 'ride');

test('streak counts back from today, or from yesterday while today is open', () => {
  const c = ticks('mn', ['2026-10-01', '2026-10-02', '2026-10-03']);
  eq(streak(c, 'mn', '2026-10-04').current, 3, 'today not ticked yet');
  ticks('mn', ['2026-10-04'], c);
  eq(streak(c, 'mn', '2026-10-04').current, 4, 'today ticked');
  eq(streak(c, 'mn', '2026-10-06').current, 0, 'a missed day breaks it');
});

test('longest streak survives a break', () => {
  const c = ticks('mn', ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-05']);
  eq(streak(c, 'mn', '2026-10-05'), { current: 1, longest: 3 });
});

test('weekly count only looks at Monday to Sunday of that week', () => {
  const c = ticks('gym', ['2026-09-27', '2026-09-28', '2026-09-30', '2026-10-05']);
  eq(weekCount(c, gym, '2026-10-01'), 2);
});

test('history marks weeks before the habit existed', () => {
  const h = weekHistory({}, gym, '2026-10-14', 4);
  eq(h.map((w) => w.beforeStart), [true, true, false, false]);
  eq(h[3].start, '2026-10-05');
});

test('a planned weekly habit only counts on its day', () => {
  eq(inPlayToday({}, ride, '2026-10-01'), false, 'Thursday');
  eq(inPlayToday({}, ride, '2026-10-03'), true, 'Saturday');
  eq(inPlayToday(ticks('ride', ['2026-10-01']), ride, '2026-10-01'), true, 'ticked anyway');
});

test('a weekly habit drops out once its quota is met, unless ticked today', () => {
  const c = ticks('gym', ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01']);
  eq(inPlayToday(c, gym, '2026-10-02'), false);
  eq(inPlayToday(c, gym, '2026-10-01'), true);
});

test('today summary matches the phone mockup: Thursday, dressage planned Saturday', () => {
  const c = ticks('mn', ['2026-10-01']);
  eq(todaySummary(c, habits, '2026-10-01'), { done: 1, total: 2 });
});

test('phone hints', () => {
  eq(phoneHint({}, ride, '2026-10-01'), 'Planned for Saturday');
  eq(phoneHint(ticks('gym', ['2026-09-29']), gym, '2026-10-01'), 'Tuesday was a session · 4× per week');
  eq(phoneHint({}, gym, '2026-10-01'), '4× per week');
});

test('planned days stop counting once the week’s quota is met', () => {
  const planned = { ...gym, plannedWeekdays: [1, 3, 5, 6] };
  eq(inPlayToday({}, planned, '2026-10-03'), true, 'Saturday, planned');
  eq(inPlayToday({}, planned, '2026-10-01'), false, 'Thursday, not planned');
  const four = ticks('gym', ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01']);
  eq(inPlayToday(four, planned, '2026-10-03'), false, 'Saturday, but four sessions already');
});

test('the line under a habit follows its plan', () => {
  eq(habitSub({ ...gym, plannedWeekdays: [1, 2, 4, 6] }), '4× per week · Mon, Tue, Thu, Sat planned');
  eq(habitSub(ride), '1× per week · Saturday planned');
  eq(habitSub(gym), '4× per week');
  eq(habitSub({ ...mn, sub: 'Daily · no exceptions' }), 'Daily · no exceptions');
});
