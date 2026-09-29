import { test, eq } from './harness.js';
import { state, ticks } from './fixtures.js';
import { markPaid, unmarkPaid } from '../src/core/actions.js';
import { migrate } from '../src/core/migrate.js';
import { atStake, defaultPenalty, owing, revolutLink } from '../src/core/penalty.js';

const wk = (period, id, m) => ({ id, level: 'week', period, title: id, measure: m });
const habit = (id) => ({ type: 'habit', habitId: id });
// Week 40 (28 Sep–4 Oct): gym 4×, Mongolian daily. Week 41: gym only.
const goals = [
  wk('2026-W40', 'gym', habit('gym')), wk('2026-W40', 'mn', habit('mn')),
  wk('2026-W41', 'gym', habit('gym')),
];
const gymWeek40 = ['2026-09-28', '2026-09-29', '2026-10-01', '2026-10-03'];
const mk = (extra = {}) => state({ goals, penalty: defaultPenalty(), ...extra });

test('a week is owed only from its Sunday: Thursday shows the stake, not a bill', () => {
  const s = mk({ checks: ticks('gym', gymWeek40) });
  eq(owing(s, '2026-10-01'), []);
  const now = atStake(s, '2026-10-01');
  eq([now.missed, now.amount], [['mn'], 5], 'Mongolian isn’t done every day');
  const sun = owing(s, '2026-10-04');
  eq(sun.map((w) => [w.key, w.missed, w.amount]), [['2026-W40', ['mn'], 5]]);
});

test('each missed goal costs 5 euros, and a perfect week costs nothing', () => {
  eq(owing(mk(), '2026-10-04')[0].amount, 10, 'both missed');
  const all = ticks('mn', ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'], ticks('gym', gymWeek40));
  eq(owing(mk({ checks: all }), '2026-10-04'), []);
});

test('a review done on Monday still bills last week; unpaid weeks pile up, no cap', () => {
  const s = mk();
  eq(owing(s, '2026-10-05').map((w) => [w.key, w.amount]), [['2026-W40', 10]]);
  eq(owing(s, '2026-10-12').map((w) => [w.key, w.amount]), [['2026-W40', 10], ['2026-W41', 5]]);
});

test('paying freezes the amount and clears the week; undo brings it back', () => {
  const s = mk();
  const paid = markPaid(s, owing(s, '2026-10-05'), '2026-10-05');
  eq(paid.penalty.paid['2026-W40'], { amount: 10, missed: ['gym', 'mn'], day: '2026-10-05' });
  eq(owing(paid, '2026-10-05'), []);
  eq(s.penalty.paid, {}, 'not changed in place');
  eq(owing(unmarkPaid(paid, '2026-W40'), '2026-10-05').length, 1);
});

test('nothing before the rule began, and no rule means nothing', () => {
  const later = mk({ penalty: { ...defaultPenalty(), since: '2026-10-05' } });
  eq(owing(later, '2026-10-04'), []);
  eq(atStake(later, '2026-10-04'), null);
  eq([owing(state({ goals }), '2026-10-04'), atStake(state({ goals }), '2026-10-04')], [[], null]);
});

test('a manual goal below 100% is a miss; a ritual-linked one follows its run', () => {
  const s = mk({
    goals: [wk('2026-W40', 'a', { type: 'manual', pct: 100 }), wk('2026-W40', 'b', { type: 'manual', pct: 90 }),
      wk('2026-W40', 'c', { type: 'ritual', ritualId: 'review' })],
    runs: {},
  });
  eq(owing(s, '2026-10-04')[0].missed, ['b', 'c']);
  s.runs = { review: { '2026-W40': { steps: { a: true, b: true }, done: true, doneDay: '2026-10-04' } } };
  eq(owing(s, '2026-10-04')[0].missed, ['b']);
});

test('the Revolut link needs a plain handle, amount in cents; migration adds the rule once', () => {
  eq(revolutLink({ revolut: 'luna123' }, 10), 'https://revolut.me/luna123?amount=1000&currency=EUR');
  eq(revolutLink({ revolut: 'luna123' }, 0), 'https://revolut.me/luna123', 'no amount: just her page');
  eq(revolutLink({}, 10), null);
  eq(revolutLink({ revolut: 'x/../y' }, 10), null);
  const m = migrate({ version: 2, habits: [], rituals: [], goals: [], checks: {}, runs: {} });
  eq(m.penalty, defaultPenalty());
  const keep = migrate({ version: 2, penalty: { since: '2026-10-05', euros: 3, paid: {} } });
  eq(keep.penalty.euros, 3, 'an existing rule is left alone');
});
