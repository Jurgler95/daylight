import { buildDays, type EntryFacts } from '../days';
import { buildInsights } from '../overview';
import { USUAL_MIN_DAYS, usualPosition, usualRanges, usualView } from '../usual';

import { d, entry, run } from './fixtures';

const START = '2026-01-01';
const ranges = (levels: number[], start = START) => usualRanges(buildDays(run(start, levels))).map((range) => `${range.lo}${range.hi}`);
const times = (n: number, level: number) => Array.from({ length: n }, () => level);

describe('usualRanges', () => {
  it('has no range below 14 days with an entry', () => {
    expect(ranges(times(USUAL_MIN_DAYS - 1, 4))).toEqual([]);
    expect(ranges(times(USUAL_MIN_DAYS, 4))).toEqual(times(USUAL_MIN_DAYS, 44).map(String));
  });

  it('is the one level of someone who picks it on four days out of five', () => {
    const levels = Array.from({ length: 60 }, (_, i) => (i % 10 === 3 ? 3 : i % 10 === 7 ? 5 : 4));
    expect(new Set(ranges(levels))).toEqual(new Set(['44']));
    expect(usualPosition(3, { lo: 4, hi: 4 })).toBe('below');
    expect(usualPosition(4, { lo: 4, hi: 4 })).toBe('usual');
    expect(usualPosition(5, { lo: 4, hi: 4 })).toBe('above');
  });

  it('takes the lowest level that reaches half of the days as the middle, not the textbook median', () => {
    // Ten 3s and ten 4s: the textbook median is 3.5, the middle here is 3 and already holds half.
    expect(new Set(ranges([...times(10, 3), ...times(10, 4)]))).toEqual(new Set(['33']));
  });

  it('widens to the more frequent neighbour, and on a tie towards the side the mean lies on', () => {
    // 4 on 40 %, more 5s than 3s.
    expect(new Set(ranges([...times(8, 4), ...times(5, 3), ...times(7, 5)]))).toEqual(new Set(['45']));
    expect(new Set(ranges([...times(8, 4), ...times(7, 3), ...times(5, 5)]))).toEqual(new Set(['34']));
    // 3 and 5 equally often: two 2s pull the mean below 4, so it widens down.
    expect(new Set(ranges([...times(2, 2), ...times(5, 3), ...times(8, 4), ...times(5, 5)]))).toEqual(new Set(['34']));
    // The same tie with the mean right on the middle widens up.
    expect(new Set(ranges([...times(6, 3), ...times(8, 4), ...times(6, 5)]))).toEqual(new Set(['45']));
  });

  it('keeps a range that still nearly fits and changes it once it clearly does not', () => {
    // 28 days of 4, then 3 and 5 in turn: the share of 4 sinks slowly.
    const levels = [...times(28, 4), ...Array.from({ length: 50 }, (_, i) => (i % 2 ? 5 : 3))];
    const list = ranges(levels);
    // With 30 other days the 4 holds 48 %: a fresh range would be wider, the old one stays.
    expect(list[57]).toBe('44');
    expect(new Set(ranges([...levels.slice(28, 58), ...times(28, 4)]))).not.toEqual(new Set(['44']));
    // Below 45 % it gives way, at once and for good.
    const change = list.findIndex((range) => range !== '44');
    expect(change).toBe(62);
    expect(list[change]).toBe('34');
  });

  it('measures the first 28 logged days against those 28, later ones included', () => {
    const list = ranges([...times(10, 2), ...times(18, 4)]);
    expect(new Set(list)).toEqual(new Set(['44']));
    // A longer diary still gives its first days the same reference.
    expect(ranges([...times(10, 2), ...times(18, 4), ...times(30, 5)]).slice(0, 28)).toEqual(list);
  });

  it('looks back 365 calendar days, and at the last 28 logged days when those hold too few', () => {
    const old = run('2024-01-01', times(40, 2));
    const later = run('2025-06-01', times(40, 4));
    const list = usualRanges(buildDays([...old, ...later])).map((range) => `${range.lo}${range.hi}`);
    // The first day after the long break still stands against 27 old days and itself.
    expect(list[40]).toBe('22');
    // Once 28 new days are there, the old ones are out.
    expect(list[40 + 27]).toBe('44');
    expect(list[79]).toBe('44');
  });
});

describe('usualView', () => {
  const diary: EntryFacts[] = [
    ...run('2026-01-01', [...times(20, 4), 2, 5, 4, 4, 3, 4, 4, 4, 4, 4, 4]),
    // 1 February: two entries, 3 and 4, a day mean of 3.5 that rounds to 4.
    entry('2026-02-01', 3, [], null, '08:00'),
    entry('2026-02-01', 4, [], null, '20:00'),
    entry('2026-02-02', 5),
    entry('2026-02-03', 1),
  ];

  it('counts every day against the range of its day, by its rounded level, per month', () => {
    const view = usualView(buildDays(diary), { from: d('2026-01-01'), to: d('2026-02-28') });
    expect(view.range).toEqual({ lo: 4, hi: 4 });
    expect(view.months).toEqual([
      { month: '2026-01-01', mean: (28 * 4 + 2 + 5 + 3) / 31, days: 31, usual: { below: 2, within: 28, above: 1 } },
      { month: '2026-02-01', mean: (3.5 + 5 + 1) / 3, days: 3, usual: { below: 1, within: 1, above: 1 } },
    ]);
  });

  it('works the ranges out over the whole diary and only then cuts to the window', () => {
    const view = usualView(buildDays(diary), { from: d('2026-02-02'), to: d('2026-02-28') });
    expect(view.months).toEqual([{ month: '2026-02-01', mean: 3, days: 2, usual: { below: 1, within: 0, above: 1 } }]);
    expect(view.range).toEqual({ lo: 4, hi: 4 });
    expect(usualView(buildDays(diary), { from: d('2026-03-01'), to: d('2026-03-31') })).toEqual({ range: null, months: [] });
  });

  it('shows only the mean while the diary is too short for a range', () => {
    const short = run('2026-01-25', times(13, 4));
    expect(usualView(buildDays(short), { from: d('2026-01-01'), to: d('2026-02-28') })).toEqual({
      range: null,
      months: [
        { month: '2026-01-01', mean: 4, days: 7, usual: null },
        { month: '2026-02-01', mean: 4, days: 6, usual: null },
      ],
    });
  });

  it('reaches "Einblicke" for the range picked', () => {
    const insights = buildInsights({ entries: diary, range: '30', today: d('2026-02-03'), firstDayOfWeek: 1 });
    expect(insights.usual).toEqual({ lo: 4, hi: 4 });
    expect(insights.months.map((month) => [month.month, month.days, month.usual])).toEqual([
      ['2026-01-01', 27, { below: 2, within: 24, above: 1 }],
      ['2026-02-01', 3, { below: 1, within: 1, above: 1 }],
    ]);
  });
});
