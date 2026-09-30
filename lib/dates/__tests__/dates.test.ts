import {
  addDaysToDateString,
  compareDateStrings,
  daysBetween,
  formatDayMonth,
  formatLong,
  formatMonthLong,
  formatMonthNarrow,
  formatMonthShort,
  formatNumeric,
  formatRange,
  formatWeekdayLong,
  isDateString,
  toDateString,
  weekdayOf,
  type DateString,
} from '../index';

const d = (s: string) => s as DateString;

describe('dates', () => {
  it('formats a Date as YYYY-MM-DD in local time', () => {
    expect(toDateString(new Date(2026, 2, 14, 23, 59))).toBe('2026-03-14');
    expect(toDateString(new Date(2026, 0, 1, 0, 0))).toBe('2026-01-01');
  });

  it('validates date strings strictly', () => {
    expect(isDateString('2026-03-14')).toBe(true);
    expect(isDateString('2026-02-30')).toBe(false);
    expect(isDateString('2026-3-4')).toBe(false);
    expect(isDateString('2026-03-14T00:00:00Z')).toBe(false);
    expect(isDateString('')).toBe(false);
  });

  it('adds days across month, year and DST boundaries', () => {
    expect(addDaysToDateString(d('2026-01-31'), 1)).toBe('2026-02-01');
    expect(addDaysToDateString(d('2026-12-31'), 1)).toBe('2027-01-01');
    expect(addDaysToDateString(d('2026-03-28'), 2)).toBe('2026-03-30');
    expect(addDaysToDateString(d('2026-10-24'), 2)).toBe('2026-10-26');
    expect(addDaysToDateString(d('2026-03-01'), -1)).toBe('2026-02-28');
  });

  it('compares lexicographically', () => {
    expect(compareDateStrings(d('2026-01-02'), d('2026-01-10'))).toBe(-1);
    expect(compareDateStrings(d('2026-01-10'), d('2026-01-02'))).toBe(1);
    expect(compareDateStrings(d('2026-01-10'), d('2026-01-10'))).toBe(0);
  });

  it('formats in German', () => {
    expect(formatLong(d('2026-03-14'))).toBe('Samstag, 14. März');
  });
});

describe('formatRange', () => {
  it('collapses same month and handles month boundaries', () => {
    expect(formatRange(d('2026-03-14'), d('2026-03-17'))).toBe('14. bis 17. März');
    expect(formatRange(d('2026-03-30'), d('2026-04-02'))).toBe('30. März bis 2. Apr.');
    expect(formatRange(d('2026-03-14'), d('2026-03-14'))).toBe('14. März');
    expect(formatRange(d('2025-01-05'), d('2026-01-08'))).toBe('5. Jan. 25 bis 8. Jan. 26');
  });
});

describe('day arithmetic', () => {
  it('counts calendar days across DST and leap years', () => {
    expect(daysBetween(d('2026-03-28'), d('2026-03-30'))).toBe(2);
    expect(daysBetween(d('2026-10-24'), d('2026-10-26'))).toBe(2);
    expect(daysBetween(d('2028-02-28'), d('2028-03-01'))).toBe(2);
    expect(daysBetween(d('2026-03-30'), d('2026-03-28'))).toBe(-2);
    expect(addDaysToDateString(d('2028-02-28'), 1)).toBe('2028-02-29');
  });
});

describe('export formats', () => {
  it('writes the German Daylio columns and numeric days', () => {
    expect(formatDayMonth(d('2026-03-01'))).toBe('1. März');
    expect(formatWeekdayLong(d('2026-09-25'))).toBe('Freitag');
    expect(formatNumeric(d('2025-12-29'))).toBe('29.12.2025');
  });
});

describe('weekdayOf', () => {
  it('matches Date.getDay, also before 1970', () => {
    expect(weekdayOf(d('2026-09-25'))).toBe(5);
    expect(weekdayOf(d('2026-09-27'))).toBe(0);
    expect(weekdayOf(d('1969-12-31'))).toBe(3);
  });
});

describe('month names', () => {
  it('abbreviates without a dot and narrows to one letter', () => {
    expect(formatMonthShort(d('2026-01-15'))).toBe('Jan');
    expect(formatMonthShort(d('2026-03-01'))).toBe('Mär');
    expect(formatMonthLong(d('2026-03-01'))).toBe('März');
    expect(formatMonthNarrow(d('2026-09-01'))).toBe('S');
  });
});
