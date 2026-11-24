import type { HealthDay } from '@/db/schema';
import { addDaysToDateString, daysBetween, type DateString } from '@/lib/dates';

import type { InsightDay } from './days';
import { settledValue, type HealthMetric } from './healthStats';
import { scaleDayValue, type ScaleFacts } from './scales';
import { MIN_WEEK_DAYS } from './swings';
import { mean } from './stats';

/**
 * Where mood, scales and health values are heading right now, over the last weeks and independent
 * of the range picked on "Einblicke". Day values are too noisy for this (a mood of 4, 4, 3, 2
 * "falls for three days" every other month), so everything counts in weeks: seven-day blocks
 * ending today. Pure; like every insight it describes the diary and says nothing about causes.
 */

/** Blocks looked at, newest first; the longest run that can be found is one less. */
export const TREND_BLOCKS = 13;
/** A run counts from this many weeks in a row in the same direction. */
export const MIN_TREND_WEEKS = 3;
/** The recent stretch, compared with the quarter before it. */
export const RECENT_DAYS = 28;
export const BEFORE_DAYS = 84;
/** Half of each stretch needs values, or the comparison is left out. */
export const MIN_RECENT_VALUES = 14;
export const MIN_BEFORE_VALUES = 42;
/** A turning point this many days before or after the start of a run is named with it. */
export const TURNING_NEAR_DAYS = 7;

export type TrendDirection = 'up' | 'down';

/** Weekly means that moved the same way week after week. */
export interface TrendRun {
  direction: TrendDirection;
  weeks: number;
  /** First day of the oldest block of the run. */
  since: DateString;
  /** Mean of that block, and of the newest one. */
  from: number;
  to: number;
}

/** The last four weeks against the twelve before them. */
export interface TrendShift {
  direction: TrendDirection;
  recent: number;
  before: number;
}

export interface Trend {
  run: TrendRun | null;
  shift: TrendShift | null;
}

export type TrendSubject = { kind: 'mood' } | { kind: 'scale'; scale: ScaleFacts } | { kind: 'health'; metric: HealthMetric };

export interface TrendItem extends Trend {
  subject: TrendSubject;
  /** A turning point near the start of the run, the newest when there are several. */
  turningPoint: { date: DateString; title: string } | null;
}

/**
 * The smallest change worth a word, from the value it starts at. Fixed per subject, so it reads
 * the same for everyone: a third of a mood step, 10 % of the steps, 20 minutes of sleep.
 */
export type MinChange = (base: number) => number;

export const MOOD_MIN_CHANGE: MinChange = () => 0.3;

/**
 * Training is left out: with one or two sessions a week, a weekly mean is mostly which day the
 * sessions fell on, and runs "from 0 to 11 minutes" would come and go.
 */
export const TREND_METRICS = ['sleep', 'steps', 'restingHr'] as const satisfies readonly HealthMetric[];

export const HEALTH_MIN_CHANGE: Record<(typeof TREND_METRICS)[number], MinChange> = {
  steps: (base) => 0.1 * base,
  sleep: () => 20,
  restingHr: () => 2,
};

/** Ratings as the mood, scaled to their span (0.3 on 1..5); durations like exercise. */
export function scaleMinChange(scale: ScaleFacts): MinChange {
  if (scale.kind === 'duration') return (base) => Math.max(15, 0.1 * base);
  return () => 0.075 * (scale.max - scale.min);
}

export interface TrendPoint {
  date: DateString;
  value: number;
}

/** Mean per seven-day block ending today, newest first; null for a block with fewer than `MIN_WEEK_DAYS` values. */
function blockMeans(points: readonly TrendPoint[], today: DateString): (number | null)[] {
  const blocks: number[][] = Array.from({ length: TREND_BLOCKS }, () => []);
  for (const point of points) {
    if (point.date > today) continue;
    const index = Math.floor(daysBetween(point.date, today) / 7);
    if (index < TREND_BLOCKS) blocks[index]!.push(point.value);
  }
  return blocks.map((values) => (values.length >= MIN_WEEK_DAYS ? mean(values) : null));
}

/**
 * From the newest block back, as long as each week is on the same side of the one before (equal
 * weeks do not break it). Needs `MIN_TREND_WEEKS` steps and a total change of at least `minChange`.
 */
function findRun(blocks: readonly (number | null)[], today: DateString, minChange: MinChange): TrendRun | null {
  const newest = blocks[0];
  if (newest == null) return null;
  let sign = 0;
  let steps = 0;
  for (let i = 0; i + 1 < blocks.length; i++) {
    const newer = blocks[i]!;
    const older = blocks[i + 1];
    if (older == null) break;
    const step = Math.sign(newer - older);
    if (sign === 0) sign = step;
    if (step !== 0 && step !== sign) break;
    steps += 1;
  }
  if (steps < MIN_TREND_WEEKS || sign === 0) return null;
  const from = blocks[steps]!;
  if (Math.abs(newest - from) < minChange(from)) return null;
  return {
    direction: sign > 0 ? 'up' : 'down',
    weeks: steps,
    since: addDaysToDateString(today, -7 * steps - 6),
    from,
    to: newest,
  };
}

function findShift(points: readonly TrendPoint[], today: DateString, minChange: MinChange): TrendShift | null {
  const recent: number[] = [];
  const before: number[] = [];
  for (const point of points) {
    if (point.date > today) continue;
    const age = daysBetween(point.date, today);
    if (age < RECENT_DAYS) recent.push(point.value);
    else if (age < RECENT_DAYS + BEFORE_DAYS) before.push(point.value);
  }
  if (recent.length < MIN_RECENT_VALUES || before.length < MIN_BEFORE_VALUES) return null;
  const a = mean(recent)!;
  const b = mean(before)!;
  if (Math.abs(a - b) < minChange(b)) return null;
  return { direction: a > b ? 'up' : 'down', recent: a, before: b };
}

/** Run and shift of one series of day values, any order; both null when nothing stands out. */
export function seriesTrend(points: readonly TrendPoint[], today: DateString, minChange: MinChange): Trend {
  return { run: findRun(blockMeans(points, today), today, minChange), shift: findShift(points, today, minChange) };
}

export interface TrendsInput {
  /** Every day of the diary, oldest first. */
  allDays: readonly InsightDay[];
  scales: readonly ScaleFacts[];
  health: readonly HealthDay[];
  turningPoints: readonly { date: string; title: string }[];
  today: DateString;
}

function nearTurningPoint(run: TrendRun | null, points: TrendsInput['turningPoints']): TrendItem['turningPoint'] {
  if (!run) return null;
  let found: TrendItem['turningPoint'] = null;
  for (const point of points) {
    const date = point.date as DateString;
    if (Math.abs(daysBetween(run.since, date)) > TURNING_NEAR_DAYS) continue;
    if (!found || date > found.date) found = { date, title: point.title };
  }
  return found;
}

/** Everything with a run or a shift: mood first, then the scales in their order, then the health values. */
export function buildTrends({ allDays, scales, health, turningPoints, today }: TrendsInput): TrendItem[] {
  const candidates: { subject: TrendSubject; points: TrendPoint[]; minChange: MinChange }[] = [
    { subject: { kind: 'mood' }, points: allDays.map((day) => ({ date: day.date, value: day.mean })), minChange: MOOD_MIN_CHANGE },
  ];
  for (const scale of scales) {
    const points = allDays.flatMap((day) => {
      const value = scaleDayValue(day, scale);
      return value === null ? [] : [{ date: day.date, value }];
    });
    candidates.push({ subject: { kind: 'scale', scale }, points, minChange: scaleMinChange(scale) });
  }
  for (const metric of TREND_METRICS) {
    const points = health.flatMap((row) => {
      const value = settledValue(row, metric, today);
      return value === null ? [] : [{ date: row.date as DateString, value }];
    });
    candidates.push({ subject: { kind: 'health', metric }, points, minChange: HEALTH_MIN_CHANGE[metric] });
  }
  return candidates.flatMap(({ subject, points, minChange }) => {
    const trend = seriesTrend(points, today, minChange);
    if (!trend.run && !trend.shift) return [];
    return [{ subject, ...trend, turningPoint: nearTurningPoint(trend.run, turningPoints) }];
  });
}
