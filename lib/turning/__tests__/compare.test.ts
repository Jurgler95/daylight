import type { HealthDay } from '@/db/schema';
import { addDaysToDateString, type DateString } from '@/lib/dates';
import { buildDays, type EntryFacts } from '@/lib/insights';

import { compareTurningPoint, MIN_SIDE_DAYS, seasonOf } from '../compare';
import { roomInYear } from '../rules';

const d = (value: string) => value as DateString;
const turn = d('2026-06-01');

/** One entry a day from `from` for `count` days, with the level and activities `pick` gives. */
function diary(from: DateString, count: number, pick: (date: DateString) => { level: number; activities?: number[] }): EntryFacts[] {
  return Array.from({ length: count }, (_, i) => {
    const date = addDaysToDateString(from, i);
    const { level, activities = [] } = pick(date);
    return { date, time: '20:00', level, activity_ids: activities };
  });
}

/** Level 2 and "work" before the turning point, level 4 and "walk" after, the day itself level 1. */
const entries = diary(d('2026-01-01'), 240, (date) =>
  date < turn ? { level: 2, activities: [1] } : date > turn ? { level: 4, activities: [2] } : { level: 1 },
);
const days = buildDays(entries);

describe('compareTurningPoint', () => {
  it('compares sides of the same length and leaves the day itself out', () => {
    const result = compareTurningPoint({ days, health: [], date: turn, span: '30', today: d('2026-09-01') });
    expect(result.length).toBe(30);
    expect(result.before).toEqual({ from: d('2026-05-02'), to: d('2026-05-31') });
    expect(result.after).toEqual({ from: d('2026-06-02'), to: d('2026-07-01') });
    expect([result.beforeMean, result.afterMean]).toEqual([2, 4]);
    expect(result.enough).toBe(true);
  });

  it('shortens both sides to what the shorter one can give', () => {
    const result = compareTurningPoint({ days, health: [], date: turn, span: '90', today: d('2026-06-21') });
    expect(result.length).toBe(20);
    expect(result.beforeDays).toBe(20);
    const all = compareTurningPoint({ days, health: [], date: turn, span: 'all', today: d('2027-01-01') });
    // Back to the first entry on 1 January.
    expect(all.length).toBe(151);
  });

  it('says nothing with too few days on a side', () => {
    const result = compareTurningPoint({ days, health: [], date: turn, span: '90', today: addDaysToDateString(turn, MIN_SIDE_DAYS - 1) });
    expect(result.enough).toBe(false);
    expect(result.activities).toEqual([]);
    expect(compareTurningPoint({ days, health: [], date: turn, span: '90', today: turn }).length).toBe(0);
  });

  it('names the activities whose share of days moved', () => {
    const result = compareTurningPoint({ days, health: [], date: turn, span: '30', today: d('2026-09-01') });
    expect(result.activities.map((row) => [row.activityId, row.beforeShare, row.afterShare])).toEqual([
      [1, 1, 0],
      [2, 0, 1],
    ]);
  });

  it('compares health values once both sides have enough of them', () => {
    const health: HealthDay[] = diary(d('2026-05-01'), 60, () => ({ level: 0 })).map((entry) => ({
      date: entry.date,
      steps: entry.date < turn ? 4000 : 8000,
      sleep_minutes: null,
      resting_hr: null,
      exercise_minutes: null,
      synced_at: 'X',
      restored: false,
    }));
    const result = compareTurningPoint({ days, health, date: turn, span: '30', today: d('2026-09-01') });
    expect(result.health.find((row) => row.metric === 'steps')).toEqual({ metric: 'steps', before: 4000, after: 8000 });
    expect(result.health.find((row) => row.metric === 'sleep')).toBeUndefined();
  });

  it('flags windows in different seasons', () => {
    expect(seasonOf(d('2026-01-15'))).toBe(0);
    expect(seasonOf(d('2026-12-01'))).toBe(0);
    expect(seasonOf(d('2026-07-01'))).toBe(2);
    expect(compareTurningPoint({ days, health: [], date: turn, span: '90', today: d('2026-12-01') }).seasons).toBe(true);
    expect(compareTurningPoint({ days, health: [], date: d('2026-07-15'), span: '30', today: d('2026-12-01') }).seasons).toBe(false);
  });
});

describe('roomInYear', () => {
  it('counts the year of the date', () => {
    expect(roomInYear(['2025-01-01', '2025-02-01', '2026-01-01'], '2025-12-31')).toBe(2);
    expect(roomInYear(['2025-01-01', '2025-02-01', '2025-03-01', '2025-04-01'], '2025-12-31')).toBe(0);
  });
});
