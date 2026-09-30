import { monthMeans, moodDistribution, moodSeries, overallMean } from '../mood';
import { pixelYears, yearPixels } from '../pixels';
import { goodStreaks, weeklySwings, weekStart } from '../swings';
import { orderWeekdays, weekdayProfile } from '../weekdays';
import { d, days, entry, run } from './fixtures';

// 2026-08-31 is a Monday, 2026-09-01 a Tuesday.

describe('moodSeries', () => {
  it('is empty without days', () => {
    expect(moodSeries([], { from: d('2026-09-01'), to: d('2026-09-30') })).toEqual([]);
  });

  it('gives one point per day in the window with a 7-day mean that looks back across the start and over gaps', () => {
    const list = days([entry('2026-09-01', 3), entry('2026-09-02', 5), entry('2026-09-04', 4), entry('2026-09-10', 2), entry('2026-09-11', 1)]);
    const points = moodSeries(list, { from: d('2026-09-02'), to: d('2026-09-10') });
    expect(points).toEqual([
      { date: '2026-09-02', mean: 5, rolling: 4 },
      { date: '2026-09-04', mean: 4, rolling: 4 },
      // 04.09. to 10.09.: 4 and 2.
      { date: '2026-09-10', mean: 2, rolling: 3 },
    ]);
  });
});

describe('moodDistribution', () => {
  it('counts days per rounded level, best first, against the window before', () => {
    const rows = moodDistribution(days(run('2026-09-01', [5, 4, 4, 3])), days(run('2026-08-01', [4, 4])));
    expect(rows.map((row) => row.level)).toEqual([5, 4, 3, 2, 1]);
    expect(rows[1]).toEqual({ level: 4, days: 2, share: 0.5, previousShare: 1 });
    expect(rows[0]).toEqual({ level: 5, days: 1, share: 0.25, previousShare: 0 });
  });

  it('has zero shares and no comparison without days', () => {
    expect(moodDistribution([], null).every((row) => row.share === 0 && row.previousShare === null)).toBe(true);
  });
});

describe('monthMeans and overallMean', () => {
  it('averages day means per month, oldest first', () => {
    const list = days([entry('2026-09-02', 5), entry('2026-08-31', 2), entry('2026-09-01', 4), entry('2026-09-01', 4)]);
    expect(monthMeans(list)).toEqual([
      { month: '2026-08-01', mean: 2, days: 1 },
      { month: '2026-09-01', mean: 4.5, days: 2 },
    ]);
    expect(overallMean(list)).toBeCloseTo(11 / 3);
    expect(overallMean([])).toBeNull();
  });
});

describe('weekdayProfile', () => {
  it('averages per weekday and shrinks the difference to the overall mean', () => {
    const profile = weekdayProfile(days([entry('2026-08-31', 2), entry('2026-09-07', 4), entry('2026-09-01', 5)]));
    expect(profile.overall).toBeCloseTo(11 / 3);
    const monday = profile.weekdays[1]!;
    expect(monday).toMatchObject({ weekday: 1, mean: 3, days: 2 });
    expect(monday.difference).toBeCloseTo(-2 / 3);
    // Two Mondays keep 2 / 12 of the difference.
    expect(monday.effect).toBeCloseTo(-1 / 9);
    expect(profile.weekdays[0]).toEqual({ weekday: 0, mean: null, days: 0, difference: null, effect: 0 });
  });

  it('orders by the first day of the week', () => {
    const order = orderWeekdays(weekdayProfile([]).weekdays, 1).map((stat) => stat.weekday);
    expect(order).toEqual([1, 2, 3, 4, 5, 6, 0]);
  });
});

describe('weeklySwings', () => {
  it('finds the week start for either first day', () => {
    expect(weekStart(d('2026-09-06'), 1)).toBe('2026-08-31');
    expect(weekStart(d('2026-09-06'), 0)).toBe('2026-09-06');
  });

  it('takes weeks with four days or more, and names each week at most once', () => {
    const list = days([
      ...run('2026-08-31', [3, 5, 3, 5]),
      ...run('2026-09-07', [4, 4, 4, 4]),
      ...run('2026-09-14', [1, 5, 1]),
    ]);
    const swings = weeklySwings(list, 1);
    expect(swings.weeks).toBe(2);
    expect(swings.typical).toBe(0.5);
    expect(swings.calmest).toEqual([{ start: '2026-09-07', mean: 4, spread: 0, days: 4 }]);
    expect(swings.roughest).toEqual([{ start: '2026-08-31', mean: 4, spread: 1, days: 4 }]);
  });

  it('is empty without weeks', () => {
    expect(weeklySwings([], 1)).toEqual({ typical: null, weeks: 0, calmest: [], roughest: [] });
  });
});

describe('goodStreaks', () => {
  // 01. to 03. good, 04. bad, 05. to 07. good, 08. missing, 09. to 10. good.
  const list = days([...run('2026-09-01', [4, 5, 4, 2, 4, 4, 4]), ...run('2026-09-09', [5, 4])]);

  it('takes the longest run, the newer on a tie, and ends a run at a gap', () => {
    expect(goodStreaks(list, d('2026-09-11')).longest).toEqual({ start: '2026-09-05', end: '2026-09-07', days: 3 });
  });

  it('keeps the current run while today is still open, and drops it after a day without entry', () => {
    expect(goodStreaks(list, d('2026-09-10')).current).toEqual({ start: '2026-09-09', end: '2026-09-10', days: 2 });
    expect(goodStreaks(list, d('2026-09-11')).current).toEqual({ start: '2026-09-09', end: '2026-09-10', days: 2 });
    expect(goodStreaks(list, d('2026-09-12')).current).toBeNull();
  });

  it('counts a day of "Ok" and "Gut" as good and has nothing without days', () => {
    expect(goodStreaks(days([entry('2026-09-01', 3), entry('2026-09-01', 4)]), d('2026-09-01')).current?.days).toBe(1);
    expect(goodStreaks([], d('2026-09-01'))).toEqual({ longest: null, current: null });
  });

  it('takes the longest run that reaches into the window at its full length', () => {
    const long = days(run('2026-08-01', Array(40).fill(4)));
    const streaks = goodStreaks(long, d('2026-09-09'), d('2026-08-11'));
    expect(streaks.longest).toEqual({ start: '2026-08-01', end: '2026-09-09', days: 40 });
    expect(streaks.current).toEqual(streaks.longest);
    // Runs that ended before the window do not count.
    expect(goodStreaks(list, d('2026-09-11'), d('2026-09-08')).longest).toEqual({ start: '2026-09-09', end: '2026-09-10', days: 2 });
  });

  it('has no current run when the last day was not good', () => {
    expect(goodStreaks(days(run('2026-09-01', [4, 2])), d('2026-09-02')).current).toBeNull();
  });
});

describe('yearPixels', () => {
  it('gives twelve months with a cell per day, null where nothing was logged', () => {
    const list = days([entry('2026-02-03', 1), entry('2025-12-31', 5)]);
    expect(pixelYears(list)).toEqual([2026, 2025]);
    const months = yearPixels(list, 2026);
    expect(months.map((month) => month.levels.length)).toEqual([31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]);
    expect(months[1]!.month).toBe('2026-02-01');
    expect(months[1]!.levels[2]).toBe(1);
    expect(months.flatMap((month) => month.levels).filter((level) => level !== null)).toEqual([1]);
    expect(yearPixels([], 2028)[1]!.levels.length).toBe(29);
  });
});
