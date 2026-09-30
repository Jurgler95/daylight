import type { HealthDay } from '@/db/schema';

import { correlation, healthStats, type HealthStats } from '../healthStats';
import { d, days, run } from './fixtures';

function health(date: string, values: Partial<HealthDay>): HealthDay {
  return { date, steps: null, sleep_minutes: null, resting_hr: null, exercise_minutes: null, synced_at: '2026-09-27T10:00:00.000Z', ...values };
}

function dateAt(start: string, offset: number): string {
  const base = Date.UTC(Number(start.slice(0, 4)), Number(start.slice(5, 7)) - 1, Number(start.slice(8, 10)));
  return new Date(base + offset * 86_400_000).toISOString().slice(0, 10);
}

const window = { from: d('2026-09-01'), to: d('2026-09-20') };

function stats(rows: HealthDay[], levels: number[], activities: (number[] | undefined)[] = []): HealthStats {
  return healthStats({ health: rows, allDays: days(run('2026-09-01', levels, activities)), window, previous: null, today: d('2026-09-20') });
}

describe('correlation', () => {
  it('is 1 for a straight rising line, -1 for a falling one, null without spread', () => {
    expect(correlation([[1, 2], [2, 4], [3, 6]])).toBeCloseTo(1);
    expect(correlation([[1, 3], [2, 2], [3, 1]])).toBeCloseTo(-1);
    expect(correlation([[1, 3], [1, 2]])).toBeNull();
  });
});

describe('healthStats', () => {
  it('summarises each metric and leaves out exercise when nothing records it', () => {
    const rows = [health('2026-09-01', { steps: 4000, sleep_minutes: 400 }), health('2026-09-02', { steps: 12000, sleep_minutes: 480 }), health('2026-09-03', { steps: 8000 })];
    const result = stats(rows, [3, 4, 3]);
    expect(result.metrics).toEqual(['sleep', 'steps']);
    expect(result.summaries.steps).toMatchObject({ mean: 8000, median: 8000, min: 4000, max: 12000, days: 3, previousMean: null });
    expect(result.summaries.sleep?.days).toBe(2);
    expect(result.healthDays).toBe(3);
    expect(result.pairedDays).toBe(3);
  });

  it('counts goal days and the run that is still going', () => {
    const steps = [11000, 12000, 3000, 10000, 10500, 10200];
    const rows = steps.map((value, i) => health(dateAt('2026-09-15', i), { steps: value }));
    const goals = stats(rows, []).goals.steps!;
    expect(goals).toMatchObject({ hit: 5, days: 6 });
    expect(goals.longest).toEqual({ start: '2026-09-18', end: '2026-09-20', days: 3 });
    expect(goals.current).toEqual(goals.longest);
  });

  it('finds records with the mood of that day', () => {
    const rows = [health('2026-09-01', { sleep_minutes: 300, resting_hr: 60 }), health('2026-09-02', { sleep_minutes: 540, resting_hr: 55 })];
    const records = stats(rows, [2, 5]).records;
    expect(records.find((r) => r.key === 'shortestSleep')).toMatchObject({ date: '2026-09-01', value: 300, mood: 2 });
    expect(records.find((r) => r.key === 'longestSleep')).toMatchObject({ date: '2026-09-02', mood: 5 });
    expect(records.find((r) => r.key === 'lowestHr')?.value).toBe(55);
    expect(records.some((r) => r.key === 'mostSteps')).toBe(false);
  });

  it('compares good with hard days and correlates sleep with mood', () => {
    const levels = [1, 2, 4, 5, 1, 2, 4, 5, 1, 2, 4, 5, 3, 3, 3];
    const rows = levels.map((level, i) => health(dateAt('2026-09-01', i), { sleep_minutes: 300 + level * 40 }));
    const result = stats(rows, levels);
    const split = result.moodSplits.find((s) => s.metric === 'sleep')!;
    expect(split.goodDays).toBe(6);
    expect(split.hardDays).toBe(6);
    expect(split.good! - split.hard!).toBeCloseTo(120);
    const same = result.links.find((l) => l.metric === 'sleep' && l.pairing === 'same')!;
    expect(same.r).toBeCloseTo(1);
    expect(same.pairs).toBe(15);
  });

  it('shows sleep of the night after an activity and steps of the same day', () => {
    // Activity 7 on every other day: fewer steps that day and a short night after it.
    const levels = Array.from({ length: 20 }, () => 3);
    const activities = levels.map((_, i) => (i % 2 === 0 ? [7] : [8]));
    const rows = levels.map((_, i) =>
      health(dateAt('2026-09-01', i), { steps: i % 2 === 0 ? 3000 : 9000, sleep_minutes: i % 2 === 1 ? 360 : 480 }),
    );
    const result = stats(rows, levels, activities);
    expect(result.activities.steps?.lowers.map((e) => [e.activityId, e.withMean, e.withoutMean])).toEqual([[7, 3000, 9000]]);
    expect(result.activities.steps?.lifts.map((e) => e.activityId)).toEqual([8]);
    // The night after a day with 7 is an odd day: 360 minutes.
    expect(result.activities.sleep?.lowers[0]).toMatchObject({ activityId: 7, withMean: 360, withoutMean: 480 });
  });
});
