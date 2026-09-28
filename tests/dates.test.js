import { test, eq } from './harness.js';
import {
  addDays, addMonths, daysInMonth, firstWeekendSunday, isoWeek, logicalDay, longLabel, shortLabel,
  weekKey, weekRangeLabel, weekStart, weekday,
} from '../src/core/dates.js';

const at = (iso) => logicalDay(new Date(iso));

test('the day starts at 04:00 Amsterdam time (summer, UTC+2)', () => {
  eq(at('2026-09-27T23:30:00Z'), '2026-09-27', '01:30 on the 28th');
  eq(at('2026-09-28T01:59:00Z'), '2026-09-27', '03:59');
  eq(at('2026-09-28T02:00:00Z'), '2026-09-28', '04:00');
  eq(at('2026-09-28T21:59:00Z'), '2026-09-28', '23:59');
});

test('the day starts at 04:00 Amsterdam time (winter, UTC+1)', () => {
  eq(at('2026-12-01T02:59:00Z'), '2026-11-30', '03:59');
  eq(at('2026-12-01T03:00:00Z'), '2026-12-01', '04:00');
});

test('the night the clocks go back still has one 04:00 boundary', () => {
  // 25 Oct 2026: 03:00 CEST becomes 02:00 CET.
  eq(at('2026-10-25T00:30:00Z'), '2026-10-24', '02:30 CEST');
  eq(at('2026-10-25T02:30:00Z'), '2026-10-24', '03:30 CET');
  eq(at('2026-10-25T03:00:00Z'), '2026-10-25', '04:00 CET');
});

test('weekdays run Monday 1 to Sunday 7', () => {
  eq(weekday('2026-09-28'), 1);
  eq(weekday('2026-10-04'), 7);
  eq(weekStart('2026-10-04'), '2026-09-28');
});

test('ISO week numbers, including year edges', () => {
  eq(weekKey('2026-09-28'), '2026-W40');
  eq(weekKey('2026-10-04'), '2026-W40');
  eq(isoWeek('2026-01-01'), { year: 2026, week: 1 });
  eq(isoWeek('2025-12-29'), { year: 2026, week: 1 });
  eq(isoWeek('2027-01-01'), { year: 2026, week: 53 });
  eq(isoWeek('2027-01-04'), { year: 2027, week: 1 });
  eq(isoWeek('2024-12-30'), { year: 2025, week: 1 });
});

test('first weekend of the month', () => {
  eq(firstWeekendSunday('2026-10'), '2026-10-04', 'Oct starts on a Thursday');
  eq(firstWeekendSunday('2026-11'), '2026-11-08', 'Nov 1 is a lone Sunday');
  eq(firstWeekendSunday('2026-08'), '2026-08-02', 'Aug 1 is a Saturday');
});

test('month and day arithmetic', () => {
  eq(daysInMonth('2026-02'), 28);
  eq(daysInMonth('2028-02'), 29);
  eq(addMonths('2026-12', 1), '2027-01');
  eq(addMonths('2026-01', -1), '2025-12');
  eq(addDays('2026-12-31', 1), '2027-01-01');
});

test('labels match the mockup', () => {
  eq(longLabel('2026-10-01'), 'Thursday, 1 October');
  eq(shortLabel('2026-10-04'), 'Sun 4 Oct');
  eq(weekRangeLabel('2026-10-01'), '28 Sep – 4 Oct');
});
