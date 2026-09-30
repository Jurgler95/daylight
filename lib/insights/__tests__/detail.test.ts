import { activityDetail, levelDetail } from '../detail';
import { days, entry, run } from './fixtures';

describe('activityDetail', () => {
  // 31.08. (Mo) to 13.09. (So): activity 1 on the Mondays and Tuesdays, with 2 alongside twice.
  const levels = [5, 5, 3, 3, 3, 3, 3, 5, 5, 3, 3, 3, 3, 3];
  const acts = [[1, 2], [1, 2], [], [], [], [3], [3], [1], [1], [], [], [3], [3], [3]];
  const detail = activityDetail(days(run('2026-08-31', levels, acts)), 1);

  it('lists its days newest first and compares the mood with and without', () => {
    expect(detail.days.map((day) => day.date)).toEqual(['2026-09-08', '2026-09-07', '2026-09-01', '2026-08-31']);
    expect(detail.share).toBeCloseTo(4 / 14);
    expect(detail.withMean).toBe(5);
    expect(detail.withoutMean).toBe(3);
    expect(detail.withLevels[0]).toEqual({ level: 5, days: 4, share: 1 });
    expect(detail.withoutLevels[2]).toEqual({ level: 3, days: 10, share: 1 });
    // Four days on the smaller side: below the minimum of five, so no effect sentence.
    expect(detail.sameDay).toBeNull();
  });

  it('counts weekdays, companions and months', () => {
    expect(detail.weekdays[1]).toEqual({ weekday: 1, days: 2, share: 1 });
    expect(detail.weekdays[3]).toEqual({ weekday: 3, days: 0, share: 0 });
    expect(detail.companions).toEqual([{ activityId: 2, days: 2, share: 0.5 }]);
    expect(detail.months).toEqual([
      { month: '2026-08-01', days: 1, loggedDays: 1 },
      { month: '2026-09-01', days: 3, loggedDays: 13 },
    ]);
  });

  it('fills months without entries and stays empty without days', () => {
    const gap = activityDetail(days([entry('2026-06-01', 4, [1]), entry('2026-08-01', 4)]), 1);
    expect(gap.months.map((month) => [month.month, month.days, month.loggedDays])).toEqual([
      ['2026-06-01', 1, 1],
      ['2026-07-01', 0, 0],
      ['2026-08-01', 0, 1],
    ]);
    const empty = activityDetail([], 1);
    expect(empty).toMatchObject({ days: [], share: 0, withMean: null, withoutMean: null, sameDay: null, months: [], companions: [] });
  });
});

describe('levelDetail', () => {
  // Four days at 2, all with activity 5, three of them with 6; eight days at 4, two with 5, all with 7.
  const list = days(
    run(
      '2026-09-01',
      [2, 2, 2, 2, 4, 4, 4, 4, 4, 4, 4, 4],
      [[5, 6], [5, 6], [5, 6], [5], [5, 7], [5, 7], [7], [7], [7], [7], [7], [7]],
    ),
  );

  it('names activities that are more and less common at the level than on other days', () => {
    const detail = levelDetail(list, 2);
    expect(detail).toMatchObject({ level: 2, days: 4, share: 1 / 3 });
    // 6: 3 of 4 against 0 of 8: (4 / 6) / (1 / 10) = 6,67. 5: 4 of 4 against 2 of 8: (5 / 6) / (3 / 10) = 2,78.
    expect(detail.typical.map((row) => [row.activityId, row.days])).toEqual([
      [6, 3],
      [5, 4],
    ]);
    expect(detail.typical[0]!.ratio).toBeCloseTo(20 / 3);
    // 7: 0 of 4 against 8 of 8: (1 / 6) / (9 / 10) = 0,19.
    expect(detail.rare.map((row) => row.activityId)).toEqual([7]);
    expect(detail.rare[0]!.ratio).toBeCloseTo(10 / 54);
  });

  it('says nothing for a level without days', () => {
    expect(levelDetail(list, 1)).toMatchObject({ days: 0, typical: [], rare: [] });
    expect(levelDetail([], 3)).toMatchObject({ days: 0, share: 0, typical: [], rare: [] });
  });
});
