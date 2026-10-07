import type { HealthDay } from '@/db/schema';
import { addDaysToDateString, daysBetween, type DateString } from '@/lib/dates';
import { daysIn, mean, moodDistribution, type DayWindow, type InsightDay, type LevelShare } from '@/lib/insights';
import { HEALTH_METRICS, metricValue, type HealthMetric } from '@/lib/insights/healthStats';

/**
 * Before and after one turning point, each turning point on its own: windows of the same length on
 * both sides, the turning day itself on neither. Like every insight it describes the diary and
 * says nothing about cause and effect: people often change something right after a hard stretch,
 * so "after" tends to look better on its own.
 */

export const TURNING_SPANS = ['30', '90', '180', 'all'] as const;
export type TurningSpan = (typeof TURNING_SPANS)[number];

/** Each side needs this many days with entries before anything is compared. */
export const MIN_SIDE_DAYS = 7;
/** An activity is listed once it was on this many days on either side. */
export const MIN_ACTIVITY_DAYS = 3;
/** Changes in the share of days smaller than this are left out. */
export const MIN_ACTIVITY_SHIFT = 0.1;
export const ACTIVITY_ROWS = 6;
/** A health value is compared once both sides have it on this many days. */
export const MIN_HEALTH_DAYS = 7;

export interface ActivityShift {
  activityId: number;
  beforeDays: number;
  afterDays: number;
  /** 0..1 of the days with entries on that side. */
  beforeShare: number;
  afterShare: number;
}

export interface HealthShift {
  metric: HealthMetric;
  before: number;
  after: number;
}

export interface TurningComparison {
  /** Days per side; the shorter of what the span asks for and what both sides can give. */
  length: number;
  before: DayWindow | null;
  after: DayWindow | null;
  beforeDays: number;
  afterDays: number;
  /** False while a side has fewer than `MIN_SIDE_DAYS` days with entries. */
  enough: boolean;
  beforeMean: number | null;
  afterMean: number | null;
  distribution: { before: LevelShare[]; after: LevelShare[] };
  activities: ActivityShift[];
  health: HealthShift[];
  /** The two windows sit in different seasons, so part of any difference may simply be the time of year. */
  seasons: boolean;
}

/** 0 winter, 1 spring, 2 summer, 3 autumn (meteorological, northern). */
export function seasonOf(date: DateString): number {
  return Math.floor((Number(date.slice(5, 7)) % 12) / 3);
}

function middle(window: DayWindow): DateString {
  return addDaysToDateString(window.from, Math.floor(daysBetween(window.from, window.to) / 2));
}

export interface TurningInput {
  /** Every day of the diary, oldest first. */
  days: readonly InsightDay[];
  health: readonly HealthDay[];
  date: DateString;
  span: TurningSpan;
  today: DateString;
}

export function compareTurningPoint({ days, health, date, span, today }: TurningInput): TurningComparison {
  const first = days[0]?.date ?? date;
  const available = Math.min(Math.max(0, daysBetween(first, date)), Math.max(0, daysBetween(date, today)));
  const length = span === 'all' ? available : Math.min(Number(span), available);
  const before = length > 0 ? { from: addDaysToDateString(date, -length), to: addDaysToDateString(date, -1) } : null;
  const after = length > 0 ? { from: addDaysToDateString(date, 1), to: addDaysToDateString(date, length) } : null;
  const beforeDays = before ? daysIn(days, before) : [];
  const afterDays = after ? daysIn(days, after) : [];
  const enough = beforeDays.length >= MIN_SIDE_DAYS && afterDays.length >= MIN_SIDE_DAYS;

  return {
    length,
    before,
    after,
    beforeDays: beforeDays.length,
    afterDays: afterDays.length,
    enough,
    beforeMean: mean(beforeDays.map((day) => day.mean)),
    afterMean: mean(afterDays.map((day) => day.mean)),
    distribution: { before: moodDistribution(beforeDays, null), after: moodDistribution(afterDays, null) },
    activities: enough ? activityShifts(beforeDays, afterDays) : [],
    health: before && after ? healthShifts(health, before, after) : [],
    seasons: !!before && !!after && seasonOf(middle(before)) !== seasonOf(middle(after)),
  };
}

/** Activities whose share of days moved most, either way. */
export function activityShifts(before: readonly InsightDay[], after: readonly InsightDay[]): ActivityShift[] {
  const count = (list: readonly InsightDay[]) => {
    const counts = new Map<number, number>();
    for (const day of list) for (const id of day.activities) counts.set(id, (counts.get(id) ?? 0) + 1);
    return counts;
  };
  const b = count(before);
  const a = count(after);
  return [...new Set([...b.keys(), ...a.keys()])]
    .map((activityId) => {
      const beforeDays = b.get(activityId) ?? 0;
      const afterDays = a.get(activityId) ?? 0;
      return { activityId, beforeDays, afterDays, beforeShare: beforeDays / before.length, afterShare: afterDays / after.length };
    })
    .filter((row) => Math.max(row.beforeDays, row.afterDays) >= MIN_ACTIVITY_DAYS && Math.abs(row.afterShare - row.beforeShare) >= MIN_ACTIVITY_SHIFT)
    .sort((x, y) => Math.abs(y.afterShare - y.beforeShare) - Math.abs(x.afterShare - x.beforeShare) || x.activityId - y.activityId)
    .slice(0, ACTIVITY_ROWS);
}

export function healthShifts(rows: readonly HealthDay[], before: DayWindow, after: DayWindow): HealthShift[] {
  const side = (window: DayWindow, metric: HealthMetric) =>
    rows.filter((row) => row.date >= window.from && row.date <= window.to).flatMap((row) => {
      const value = metricValue(row, metric);
      return value === null ? [] : [value];
    });
  return HEALTH_METRICS.flatMap((metric) => {
    const b = side(before, metric);
    const a = side(after, metric);
    if (b.length < MIN_HEALTH_DAYS || a.length < MIN_HEALTH_DAYS) return [];
    return [{ metric, before: mean(b)!, after: mean(a)! }];
  });
}
