import type { HealthDay, Scale } from '@/db/schema';
import { addDaysToDateString, weekdayOf, type DateString } from '@/lib/dates';
import { DURATION_MAX_MINUTES } from '@/lib/scales/duration';

import { byDate, type InsightDay } from './days';
import { MIN_SIDE_DAYS } from './effects';
import { MIN_BAND_DAYS } from './health';
import {
  correlation,
  GOOD_MIN,
  HARD_MAX,
  HEALTH_METRICS,
  MIN_LINK_PAIRS,
  settledValue,
  valueEffects,
  type ActivityHealth,
  type HealthMetric,
  type HealthPoint,
  type MetricWeekday,
} from './healthStats';
import { ROLLING_DAYS } from './mood';
import { inWindow, type DayWindow } from './range';
import { mean, median } from './stats';

/**
 * Own scales (energy, stress, hours of work) on "Einblicke" and the detail pages: their course,
 * how they go with mood and activities. Pure, on whatever days and scales it is given. Like every
 * insight it describes the diary and says nothing about cause and effect.
 */

/** What the insights need from a scale; `Scale` fits as it is. */
export type ScaleFacts = Pick<Scale, 'id' | 'name' | 'min' | 'max' | 'kind'>;

/**
 * A scale's value on one day, null without one. Ratings of several entries average like the mood;
 * durations add up, since two entries with an hour of reading each make two hours, capped at a day.
 */
export function scaleDayValue(day: InsightDay, scale: ScaleFacts): number | null {
  const values = day.scales.get(scale.id);
  if (!values || values.count === 0) return null;
  return scale.kind === 'duration' ? Math.min(values.sum, DURATION_MAX_MINUTES) : values.sum / values.count;
}

export interface ScaleSummary {
  mean: number;
  median: number;
  min: number;
  max: number;
  /** Days with a value inside the window. */
  days: number;
  /** Mean over the window before, null without one or without values there. */
  previousMean: number | null;
}

/** Days whose value falls into `from..to` (both included; `to` null is open), and their mean mood. */
export interface ScaleBucket {
  from: number;
  to: number | null;
  days: number;
  /** Null below `MIN_BAND_DAYS`. */
  mood: number | null;
}

/** Correlation of the scale with the mood of the same day and of the day after. */
export interface ScaleLink {
  pairing: 'same' | 'next';
  r: number;
  pairs: number;
}

export interface ScaleSplit {
  good: number | null;
  goodDays: number;
  hard: number | null;
  hardDays: number;
}

export interface ScaleInsight {
  scale: ScaleFacts;
  summary: ScaleSummary;
  series: HealthPoint[];
  weekdays: MetricWeekday[];
  buckets: ScaleBucket[];
  links: ScaleLink[];
  split: ScaleSplit;
  activities: ActivityHealth;
}

/** Durations are grouped like a day is lived: nothing, under an hour, a couple of hours, half a day, more. */
export const DURATION_BUCKETS: readonly (readonly [number, number | null])[] = [
  [0, 0],
  [1, 59],
  [60, 119],
  [120, 239],
  [240, 479],
  [480, null],
];

function bucketsFor(scale: ScaleFacts): (readonly [number, number | null])[] {
  if (scale.kind === 'duration') return [...DURATION_BUCKETS];
  return Array.from({ length: scale.max - scale.min + 1 }, (_, i) => [scale.min + i, scale.min + i] as const);
}

function valuesIn(days: readonly InsightDay[], scale: ScaleFacts): number[] {
  return days.flatMap((day) => {
    const value = scaleDayValue(day, scale);
    return value === null ? [] : [value];
  });
}

/** Oldest first; the rolling mean looks back across the window start like the mood line. */
function series(allDays: readonly InsightDay[], scale: ScaleFacts, window: DayWindow): HealthPoint[] {
  const points: HealthPoint[] = [];
  const recent: { date: DateString; value: number }[] = [];
  for (const day of allDays) {
    if (day.date > window.to) break;
    const value = scaleDayValue(day, scale);
    if (value === null) continue;
    recent.push({ date: day.date, value });
    const earliest = addDaysToDateString(day.date, 1 - ROLLING_DAYS);
    while (recent[0]!.date < earliest) recent.shift();
    if (day.date >= window.from) points.push({ date: day.date, value, rolling: mean(recent.map((r) => r.value))! });
  }
  return points;
}

function link(days: readonly InsightDay[], moods: Map<DateString, InsightDay>, scale: ScaleFacts, pairing: ScaleLink['pairing']): ScaleLink | null {
  const pairs: [number, number][] = [];
  for (const day of days) {
    const value = scaleDayValue(day, scale);
    if (value === null) continue;
    const mood = pairing === 'same' ? day : moods.get(addDaysToDateString(day.date, 1));
    if (mood) pairs.push([value, mood.mean]);
  }
  if (pairs.length < MIN_LINK_PAIRS) return null;
  const r = correlation(pairs);
  return r === null ? null : { pairing, r, pairs: pairs.length };
}

function insight(scale: ScaleFacts, allDays: readonly InsightDay[], days: readonly InsightDay[], before: readonly InsightDay[] | null, moods: Map<DateString, InsightDay>, window: DayWindow): ScaleInsight | null {
  const values = valuesIn(days, scale);
  if (values.length === 0) return null;
  const weekdayValues: number[][] = Array.from({ length: 7 }, () => []);
  const good: number[] = [];
  const hard: number[] = [];
  const pairs: { activities: ReadonlySet<number>; value: number }[] = [];
  const ranges = bucketsFor(scale);
  const bucketMoods: number[][] = ranges.map(() => []);
  for (const day of days) {
    const value = scaleDayValue(day, scale);
    if (value === null) continue;
    weekdayValues[weekdayOf(day.date)]!.push(value);
    if (day.mean >= GOOD_MIN) good.push(value);
    else if (day.mean <= HARD_MAX) hard.push(value);
    pairs.push({ activities: day.activities, value });
    // A day mean of 3.5 from two entries sits with the 4s, as the day's mood level does.
    const rounded = scale.kind === 'duration' ? value : Math.floor(value + 0.5);
    const index = ranges.findIndex(([from, to]) => rounded >= from && (to === null || rounded <= to));
    if (index >= 0) bucketMoods[index]!.push(day.mean);
  }
  return {
    scale,
    summary: {
      mean: mean(values)!,
      median: median(values)!,
      min: Math.min(...values),
      max: Math.max(...values),
      days: values.length,
      previousMean: before ? mean(valuesIn(before, scale)) : null,
    },
    series: series(allDays, scale, window),
    weekdays: weekdayValues.map((list, weekday) => ({ weekday, mean: mean(list), days: list.length })),
    buckets: ranges.map(([from, to], i) => {
      const list = bucketMoods[i]!;
      return { from, to, days: list.length, mood: list.length >= MIN_BAND_DAYS ? mean(list) : null };
    }),
    links: (['same', 'next'] as const).flatMap((pairing) => link(days, moods, scale, pairing) ?? []),
    split: { good: mean(good), goodDays: good.length, hard: mean(hard), hardDays: hard.length },
    activities: valueEffects(pairs),
  };
}

export interface ScaleStatsInput {
  /** In display order; those without a value in the window are left out. */
  scales: readonly ScaleFacts[];
  /** Every diary day, oldest first. */
  allDays: readonly InsightDay[];
  window: DayWindow;
  previous: DayWindow | null;
}

/** One entry per scale with values in the window, in the order given. */
export function scaleStats({ scales, allDays, window, previous }: ScaleStatsInput): ScaleInsight[] {
  const days = allDays.filter((day) => inWindow(day.date, window));
  const before = previous ? allDays.filter((day) => inWindow(day.date, previous)) : null;
  const moods = byDate(allDays);
  return scales.flatMap((scale) => insight(scale, allDays, days, before, moods, window) ?? []);
}

export interface ScaleComparison {
  scale: ScaleFacts;
  /** Mean on the days picked and on all other days. */
  withMean: number;
  withoutMean: number;
  withDays: number;
  withoutDays: number;
}

/**
 * Each scale on the days picked (with an activity, at a mood level) against all other days, for the
 * detail pages. Only scales with `MIN_SIDE_DAYS` values on both sides.
 */
export function compareScales(days: readonly InsightDay[], scales: readonly ScaleFacts[], picked: (day: InsightDay) => boolean): ScaleComparison[] {
  return scales.flatMap((scale) => {
    const withValues: number[] = [];
    const withoutValues: number[] = [];
    for (const day of days) {
      const value = scaleDayValue(day, scale);
      if (value !== null) (picked(day) ? withValues : withoutValues).push(value);
    }
    if (withValues.length < MIN_SIDE_DAYS || withoutValues.length < MIN_SIDE_DAYS) return [];
    return [{ scale, withMean: mean(withValues)!, withoutMean: mean(withoutValues)!, withDays: withValues.length, withoutDays: withoutValues.length }];
  });
}

/** Two scales on the same days, `a` before `b` in the order the scales were given. */
export interface ScalePairLink {
  a: ScaleFacts;
  b: ScaleFacts;
  r: number;
  pairs: number;
}

/** Every pair of scales with `MIN_LINK_PAIRS` days carrying both, strongest first; `a` comes before `b` in the order given. */
export function scalePairLinks(days: readonly InsightDay[], scales: readonly ScaleFacts[]): ScalePairLink[] {
  const links: ScalePairLink[] = [];
  scales.forEach((a, i) => {
    for (const b of scales.slice(i + 1)) {
      const pairs: [number, number][] = [];
      for (const day of days) {
        const x = scaleDayValue(day, a);
        const y = scaleDayValue(day, b);
        if (x !== null && y !== null) pairs.push([x, y]);
      }
      if (pairs.length < MIN_LINK_PAIRS) continue;
      const r = correlation(pairs);
      if (r !== null) links.push({ a, b, r, pairs: pairs.length });
    }
  });
  return links.sort((x, y) => Math.abs(y.r) - Math.abs(x.r));
}

export interface ScaleHealthLink {
  scale: ScaleFacts;
  metric: HealthMetric;
  r: number;
  pairs: number;
}

/**
 * Each scale against each health value of the same day, strongest first. Sleep belongs to the day
 * it ends on, so it is the night before, as on the health cards. Today's steps and training are
 * not final yet and stay out.
 */
export function scaleHealthLinks(days: readonly InsightDay[], scales: readonly ScaleFacts[], health: readonly HealthDay[], today: DateString): ScaleHealthLink[] {
  const rows = new Map(health.map((row) => [row.date, row]));
  const links: ScaleHealthLink[] = [];
  for (const scale of scales) {
    for (const metric of HEALTH_METRICS) {
      const pairs: [number, number][] = [];
      for (const day of days) {
        const value = scaleDayValue(day, scale);
        const body = settledValue(rows.get(day.date), metric, today);
        if (value !== null && body !== null) pairs.push([body, value]);
      }
      if (pairs.length < MIN_LINK_PAIRS) continue;
      const r = correlation(pairs);
      if (r !== null) links.push({ scale, metric, r, pairs: pairs.length });
    }
  }
  return links.sort((x, y) => Math.abs(y.r) - Math.abs(x.r));
}
