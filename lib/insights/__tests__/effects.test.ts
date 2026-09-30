import { activityCounts, activityPairs, groupRows } from '../activities';
import { beforeHardDays } from '../beforeHard';
import { activityEffects, effectMap, splitEffects } from '../effects';
import { days, entry, run } from './fixtures';

// Twelve days from 01.09. Activity 1 on five of them (5, 5, 4, 4, 4: mean 4,4), the other seven
// average 22 / 7. Activity 2 is on three days only.
const LEVELS = [5, 3, 5, 3, 4, 4, 2, 4, 4, 3, 4, 3];
const ACTS = [[1], [2], [1], [2], [1], [], [2], [1], [1], [], [], []];
const list = days(run('2026-09-01', LEVELS, ACTS));

describe('activityEffects', () => {
  it('compares days with and without, and shrinks by the smaller side', () => {
    const [effect, ...rest] = activityEffects(list);
    expect(rest).toEqual([]);
    expect(effect).toMatchObject({ activityId: 1, withMean: 4.4, withDays: 5, withoutDays: 7 });
    expect(effect!.withoutMean).toBeCloseTo(22 / 7);
    expect(effect!.difference).toBeCloseTo(4.4 - 22 / 7);
    // Five days on the smaller side keep 5 / 15 of the difference.
    expect(effect!.effect).toBeCloseTo((4.4 - 22 / 7) / 3);
  });

  it('takes the next day\'s mood with lag 1', () => {
    // Pairs are days 1..11 with their successor. With activity 1: next moods 3, 3, 4, 4, 3.
    const [effect] = activityEffects(list, { lag: 1 });
    expect(effect).toMatchObject({ activityId: 1, withMean: 3.4, withDays: 5, withoutDays: 6 });
    expect(effect!.withoutMean).toBeCloseTo(22 / 6);
    expect(effect!.effect).toBeCloseTo((3.4 - 22 / 6) / 3);
  });

  it('needs two consecutive days for a next-day pair', () => {
    expect(activityEffects(days([entry('2026-09-01', 4, [1]), entry('2026-09-03', 2)]), { lag: 1, minSide: 0 })).toEqual([]);
  });

  it('is empty without days and honours the minimum per side', () => {
    expect(activityEffects([])).toEqual([]);
    expect(activityEffects(list, { minSide: 6 })).toEqual([]);
    expect(activityEffects(list, { minSide: 3 }).map((e) => e.activityId)).toEqual([1, 2]);
  });

  it('splits into lifts and lowers beyond a tenth of a step', () => {
    const all = activityEffects(list, { minSide: 3 });
    const { lifts, lowers } = splitEffects(all);
    expect(lifts.map((e) => e.activityId)).toEqual([1]);
    expect(lowers.map((e) => e.activityId)).toEqual([2]);
    expect(effectMap(all).get(2)?.withDays).toBe(3);
  });
});

describe('activityCounts', () => {
  it('counts days per activity against the window before, keeping activities that disappeared', () => {
    const counts = activityCounts(days(run('2026-09-01', [4, 4], [[1, 2], [1]])), days(run('2026-08-01', [4], [[3]])));
    expect(counts).toEqual([
      { activityId: 1, days: 2, previousDays: 0 },
      { activityId: 2, days: 1, previousDays: 0 },
      { activityId: 3, days: 0, previousDays: 1 },
    ]);
    expect(activityCounts(days(run('2026-09-01', [4], [[1]])), null)).toEqual([{ activityId: 1, days: 1, previousDays: null }]);
  });
});

describe('activityPairs', () => {
  // Ten days: 1 and 2 together on the first five, 3 on the other five, 4 every day.
  const pairDays = days(
    run(
      '2026-09-01',
      [5, 5, 4, 4, 4, 3, 3, 3, 3, 3],
      Array.from({ length: 10 }, (_, i) => (i < 5 ? [1, 2, 4] : [3, 4])),
    ),
  );

  it('keeps pairs that come together more often than chance, with their mood', () => {
    // 5 shared days of 10, each on 5 days: 5 · 10 / (5 · 5) = 2. With 4 every day the lift is 1.
    expect(activityPairs(pairDays)).toEqual([{ a: 1, b: 2, together: 5, lift: 2, mean: 4.4 }]);
  });

  it('needs five shared days', () => {
    expect(activityPairs(pairDays, 6)).toEqual([]);
    expect(activityPairs([])).toEqual([]);
  });
});

describe('groupRows', () => {
  it('gives the mood per activity of a group plus the days with none of them', () => {
    const rows = groupRows(days(run('2026-09-01', [5, 5, 4, 2, 2, 3, 3, 3], [[10], [10], [10], [11], [11], [], [], [9]])), [10, 11, 12]);
    expect(rows).toEqual([
      { activityId: 10, days: 3, mean: 14 / 3 },
      { activityId: 11, days: 2, mean: null },
      { activityId: null, days: 3, mean: 3 },
    ]);
  });
});

describe('beforeHardDays', () => {
  // Twelve days, difficult on days 4, 8 and 12, activity 7 the day before each and on day 1.
  const levels = [4, 4, 4, 2, 4, 4, 4, 2, 4, 4, 4, 2];
  const acts = [[7], [], [7], [], [], [8], [7], [], [], [], [7], []];

  it('compares the two days before difficult days with the two days before any day', () => {
    const result = beforeHardDays(days(run('2026-09-01', levels, acts)));
    expect(result.hardDays).toBe(3);
    // Activity 7 comes up before all 3 difficult days and before 7 of the 11 days with a logged lookback.
    expect(result.items).toEqual([
      { activityId: 7, hardDays: 3, hardShare: 1, baseShare: 7 / 11, ratio: 11 / 7, effect: expect.closeTo(1 + (4 / 7) * (3 / 8), 10) },
    ]);
  });

  it('says nothing below three difficult days', () => {
    expect(beforeHardDays(days(run('2026-09-01', levels.slice(0, 8), acts)))).toEqual({ hardDays: 2, items: [] });
    expect(beforeHardDays([])).toEqual({ hardDays: 0, items: [] });
  });
});
