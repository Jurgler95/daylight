import { buildDays, type EntryFacts } from '../days';
import type { HealthDay } from '@/db/schema';

import { compareScales, numberBuckets, scaleDayValue, scaleHealthLinks, scalePairLinks, scaleStats, type ScaleFacts } from '../scales';
import { d } from './fixtures';

const energy: ScaleFacts = { id: 1, name: 'Energie', min: 1, max: 5, kind: 'rating' };
const work: ScaleFacts = { id: 2, name: 'Arbeit', min: 0, max: 1440, kind: 'duration' };

/** Consecutive days from 2026-01-01, one entry each: level, energy, activities. */
function diary(rows: [level: number, energy: number | null, activities?: number[]][]): EntryFacts[] {
  return rows.map(([level, value, activities = []], i) => ({
    date: new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10),
    time: '20:00',
    level,
    activity_ids: activities,
    scales: value === null ? [] : [{ scale_id: energy.id, value }],
  }));
}

describe('scaleDayValue', () => {
  it('averages ratings and adds up durations of several entries, capped at a day', () => {
    const [day] = buildDays([
      { date: '2026-01-01', time: '08:00', level: 3, activity_ids: [], scales: [{ scale_id: 1, value: 2 }, { scale_id: 2, value: 900 }] },
      { date: '2026-01-01', time: '20:00', level: 4, activity_ids: [], scales: [{ scale_id: 1, value: 5 }, { scale_id: 2, value: 900 }] },
    ]);
    expect(scaleDayValue(day!, energy)).toBe(3.5);
    expect(scaleDayValue(day!, work)).toBe(1440);
    expect(scaleDayValue(day!, { ...energy, id: 9 })).toBeNull();
  });
});

describe('scaleStats', () => {
  // Energy follows mood: 20 days, levels and energy alike, sport on the high days.
  const levels = Array.from({ length: 20 }, (_, i) => 1 + (i % 5));
  const days = buildDays(diary(levels.map((level) => [level, level, level >= 4 ? [7] : []])));
  const window = { from: d('2026-01-01'), to: d('2026-01-20') };
  const [stats] = scaleStats({ scales: [energy, work], allDays: days, window, previous: null });

  it('leaves out scales without values', () => {
    expect(scaleStats({ scales: [energy, work], allDays: days, window, previous: null }).map((s) => s.scale.id)).toEqual([1]);
  });

  it('summarises the values in the window', () => {
    expect(stats!.summary).toMatchObject({ mean: 3, median: 3, min: 1, max: 5, days: 20, previousMean: null });
    expect(stats!.series).toHaveLength(20);
  });

  it('gives the mood per value and a strong same-day link', () => {
    expect(stats!.buckets.map((b) => [b.from, b.days, b.mood])).toEqual([
      [1, 4, 1],
      [2, 4, 2],
      [3, 4, 3],
      [4, 4, 4],
      [5, 4, 5],
    ]);
    expect(stats!.links.find((l) => l.pairing === 'same')).toMatchObject({ r: 1, pairs: 20 });
  });

  it('splits good and hard days and finds the activity that goes with high values', () => {
    expect(stats!.split).toEqual({ good: 4.5, goodDays: 8, hard: 1.5, hardDays: 8 });
    expect(stats!.activities.lifts.map((e) => e.activityId)).toEqual([7]);
  });
});

describe('compareScales', () => {
  it('needs enough days on both sides', () => {
    const days = buildDays(diary(Array.from({ length: 12 }, (_, i) => [3, i < 6 ? 5 : 2, i < 6 ? [7] : []])));
    expect(compareScales(days, [energy], (day) => day.activities.has(7))).toEqual([
      { scale: energy, withMean: 5, withoutMean: 2, withDays: 6, withoutDays: 6 },
    ]);
    expect(compareScales(days.slice(0, 9), [energy], (day) => day.activities.has(7))).toEqual([]);
  });
});

describe('scalePairLinks and scaleHealthLinks', () => {
  const stress: ScaleFacts = { id: 3, name: 'Stress', min: 1, max: 5, kind: 'rating' };
  // Energy runs 1..5, stress the other way round, sleep with energy.
  const entries: EntryFacts[] = Array.from({ length: 15 }, (_, i) => ({
    date: new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10),
    time: '20:00',
    level: 3,
    activity_ids: [],
    scales: [
      { scale_id: energy.id, value: 1 + (i % 5) },
      { scale_id: stress.id, value: 5 - (i % 5) },
    ],
  }));
  const days = buildDays(entries);
  const health = entries.map((entry, i) => ({ date: entry.date, sleep_minutes: 360 + (i % 5) * 30, steps: null, resting_hr: null, exercise_minutes: null }) as HealthDay);

  it('finds two scales moving against each other', () => {
    expect(scalePairLinks(days, [energy, stress])).toEqual([{ a: energy, b: stress, r: -1, pairs: 15 }]);
    expect(scalePairLinks(days.slice(0, 13), [energy, stress])).toEqual([]);
  });

  it('pairs each scale with the sleep of the night before', () => {
    expect(scaleHealthLinks(days, [energy], health, d('2026-02-01'))).toEqual([{ scale: energy, metric: 'sleep', r: 1, pairs: 15 }]);
  });

  it('gives no link for a scale or a health value that never changes', () => {
    const calm: ScaleFacts = { id: 4, name: 'Ruhe', min: 1, max: 5, kind: 'rating' };
    const flat = buildDays(entries.map((entry) => ({ ...entry, scales: [...entry.scales!, { scale_id: calm.id, value: 3 }] })));
    expect(scalePairLinks(flat, [energy, calm])).toEqual([]);
    const sameSleep = health.map((row) => ({ ...row, sleep_minutes: 420 }));
    expect(scaleHealthLinks(days, [energy], sameSleep, d('2026-02-01'))).toEqual([]);
  });
});

describe('number scales', () => {
  const weight: ScaleFacts = { id: 3, name: 'Gewicht', min: 0, max: 0, kind: 'number', unit: 'kg', decimals: 1 };
  // 20 days, weight between 70 and 73.8, lighter on the good days.
  const facts: EntryFacts[] = Array.from({ length: 20 }, (_, i) => ({
    date: new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10),
    time: '07:00',
    level: 1 + (i % 5),
    activity_ids: [],
    scales: [{ scale_id: weight.id, value: 74 - (1 + (i % 5)) * 0.8 + (i % 2) * 0.2 }],
  }));
  const days = buildDays(facts);
  const window = { from: d('2026-01-01'), to: d('2026-01-20') };

  it('average several entries of a day', () => {
    const [day] = buildDays([
      { date: '2026-01-01', time: '07:00', level: 3, activity_ids: [], scales: [{ scale_id: 3, value: 72.4 }] },
      { date: '2026-01-01', time: '21:00', level: 3, activity_ids: [], scales: [{ scale_id: 3, value: 73 }] },
    ]);
    expect(scaleDayValue(day!, weight)).toBeCloseTo(72.7);
  });

  it('split the days at the quartiles, every day in exactly one bucket', () => {
    const [stats] = scaleStats({ scales: [weight], allDays: days, window, previous: null });
    const buckets = stats!.buckets;
    expect(buckets.length).toBeGreaterThan(1);
    expect(buckets[buckets.length - 1]!.to).toBeNull();
    for (let i = 1; i < buckets.length; i++) expect(buckets[i]!.from).toBe(buckets[i - 1]!.to);
    expect(buckets.reduce((sum, bucket) => sum + bucket.days, 0)).toBe(20);
    // Lighter days are the good ones here.
    expect(buckets[0]!.mood!).toBeGreaterThan(buckets[buckets.length - 1]!.mood!);
    expect(stats!.links.find((link) => link.pairing === 'same')!.r).toBeLessThan(-0.9);
  });

  it('give one bucket when every value is the same', () => {
    expect(numberBuckets([5, 5, 5], 0)).toEqual([[5, null]]);
    expect(numberBuckets([], 1)).toEqual([]);
  });
});
