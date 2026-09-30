import type { HealthDay } from '@/db/schema';
import { addDaysToDateString, daysBetween, weekdayOf, type DateString } from '@/lib/dates';

import { byDate, type InsightDay } from './days';
import { MIN_SIDE_DAYS } from './effects';
import { ROLLING_DAYS } from './mood';
import { inWindow, windowLength, type DayWindow } from './range';
import { mean, median, shrinkFactor, standardDeviation, SHRINK_K } from './stats';
import type { Streak } from './swings';

/**
 * Everything the "Gesundheit" tab shows beyond the mood bands: the values themselves, their trend,
 * goals, records, and how they line up with mood and activities. Pure, on whatever rows and days
 * it is given. Like every insight it describes the diary and says nothing about cause and effect.
 */

export const HEALTH_METRICS = ['sleep', 'steps', 'restingHr', 'exercise'] as const;
export type HealthMetric = (typeof HEALTH_METRICS)[number];

/** Nights from this long count towards the sleep goal. */
export const SLEEP_GOAL_MINUTES = 7 * 60;
export const STEPS_GOAL = 10_000;
/** Below this many pairs no correlation is shown. */
export const MIN_LINK_PAIRS = 14;
/** Day means from this level are "good", up to `HARD_MAX` "hard", as in the other insights. */
export const GOOD_MIN = 4;
export const HARD_MAX = 2;
/** Shrunk differences smaller than this share of the metric's spread are left out. */
export const MIN_ACTIVITY_EFFECT = 0.15;

/**
 * A day's value. Exercise is 0 on a day with other data but no session, since the watch was worn;
 * a day without any row stays unknown.
 */
export function metricValue(row: HealthDay | undefined, metric: HealthMetric): number | null {
  if (!row) return null;
  switch (metric) {
    case 'sleep':
      return row.sleep_minutes;
    case 'steps':
      return row.steps;
    case 'restingHr':
      return row.resting_hr;
    case 'exercise':
      return row.exercise_minutes ?? 0;
  }
}

export interface MetricSummary {
  metric: HealthMetric;
  mean: number;
  median: number;
  min: number;
  max: number;
  /** Days with a value inside the window. */
  days: number;
  /** Mean over the window before, null without one or without values there. */
  previousMean: number | null;
}

export interface HealthPoint {
  date: DateString;
  value: number;
  /** Mean of the values among this day and the six before it. */
  rolling: number;
}

export interface MetricWeekday {
  /** 0 = Sunday, like `weekdayOf`. */
  weekday: number;
  mean: number | null;
  days: number;
}

export interface GoalStats {
  /** Days that reached the goal. */
  hit: number;
  /** Days with a value. */
  days: number;
  /** Longest run of consecutive days at the goal that reaches into the window. */
  longest: Streak | null;
  /** The run that ends today or yesterday. */
  current: Streak | null;
}

export interface HealthGoals {
  sleep: GoalStats | null;
  steps: GoalStats | null;
  /** Days with any exercise. */
  exercise: (GoalStats & { minutesPerWeek: number }) | null;
}

export const RECORD_KEYS = ['mostSteps', 'fewestSteps', 'longestSleep', 'shortestSleep', 'longestExercise', 'lowestHr', 'highestHr'] as const;
export type RecordKey = (typeof RECORD_KEYS)[number];

export interface HealthRecord {
  key: RecordKey;
  metric: HealthMetric;
  date: DateString;
  value: number;
  /** The day's mood, null without an entry. */
  mood: number | null;
}

export interface MoodSplit {
  metric: HealthMetric;
  good: number | null;
  goodDays: number;
  hard: number | null;
  hardDays: number;
  all: number | null;
  allDays: number;
}

/** Which days a correlation pairs, see `LINK_PAIRINGS`. */
export type LinkPairing = 'same' | 'next' | 'nightAfter';

export interface HealthLink {
  metric: HealthMetric;
  pairing: LinkPairing;
  /** Pearson correlation, -1..1. */
  r: number;
  pairs: number;
}

export interface ActivityHealthEffect {
  activityId: number;
  withMean: number;
  withoutMean: number;
  withDays: number;
  withoutDays: number;
  difference: number;
  /** `difference` shrunk by the smaller side and divided by the metric's spread: what sorts. */
  effect: number;
}

export interface ActivityHealth {
  lifts: ActivityHealthEffect[];
  lowers: ActivityHealthEffect[];
}

export interface HealthStats {
  /** Metrics with at least one value in the window (exercise: at least one session), in `HEALTH_METRICS` order. */
  metrics: HealthMetric[];
  summaries: Partial<Record<HealthMetric, MetricSummary>>;
  series: Partial<Record<HealthMetric, HealthPoint[]>>;
  weekdays: Partial<Record<HealthMetric, MetricWeekday[]>>;
  goals: HealthGoals;
  records: HealthRecord[];
  moodSplits: MoodSplit[];
  links: HealthLink[];
  activities: Partial<Record<HealthMetric, ActivityHealth>>;
  /** Days in the window with a health row, and with a health row and an entry. */
  healthDays: number;
  pairedDays: number;
}

export interface HealthStatsInput {
  health: readonly HealthDay[];
  /** Every diary day, oldest first; the window is cut here, the day after is looked up here too. */
  allDays: readonly InsightDay[];
  window: DayWindow;
  previous: DayWindow | null;
  today: DateString;
}

function valuesIn(rows: readonly HealthDay[], window: DayWindow, metric: HealthMetric): number[] {
  const values: number[] = [];
  for (const row of rows) {
    if (!inWindow(row.date as DateString, window)) continue;
    const value = metricValue(row, metric);
    if (value !== null) values.push(value);
  }
  return values;
}

function summary(rows: readonly HealthDay[], metric: HealthMetric, window: DayWindow, previous: DayWindow | null): MetricSummary | null {
  const values = valuesIn(rows, window, metric);
  if (values.length === 0) return null;
  return {
    metric,
    mean: mean(values)!,
    median: median(values)!,
    min: Math.min(...values),
    max: Math.max(...values),
    days: values.length,
    previousMean: previous ? mean(valuesIn(rows, previous, metric)) : null,
  };
}

/** Oldest first, rolling mean looks back across the window start like the mood line. */
function series(rows: readonly HealthDay[], metric: HealthMetric, window: DayWindow): HealthPoint[] {
  const points: HealthPoint[] = [];
  const recent: { date: DateString; value: number }[] = [];
  for (const row of rows) {
    const date = row.date as DateString;
    if (date > window.to) break;
    const value = metricValue(row, metric);
    if (value === null) continue;
    recent.push({ date, value });
    const earliest = addDaysToDateString(date, 1 - ROLLING_DAYS);
    while (recent[0]!.date < earliest) recent.shift();
    if (date >= window.from) points.push({ date, value, rolling: mean(recent.map((r) => r.value))! });
  }
  return points;
}

function weekdays(rows: readonly HealthDay[], metric: HealthMetric, window: DayWindow): MetricWeekday[] {
  const buckets: number[][] = Array.from({ length: 7 }, () => []);
  for (const row of rows) {
    const date = row.date as DateString;
    if (!inWindow(date, window)) continue;
    const value = metricValue(row, metric);
    if (value !== null) buckets[weekdayOf(date)]!.push(value);
  }
  return buckets.map((values, weekday) => ({ weekday, mean: mean(values), days: values.length }));
}

/** Runs over the whole history, so a run that began before the window keeps its full length. */
function goal(rows: readonly HealthDay[], metric: HealthMetric, reached: (value: number) => boolean, window: DayWindow, today: DateString): GoalStats | null {
  let hit = 0;
  let days = 0;
  const runs: Streak[] = [];
  let run: Streak | null = null;
  let lastDate: DateString | null = null;
  for (const row of rows) {
    const date = row.date as DateString;
    if (date > window.to) break;
    const value = metricValue(row, metric);
    if (value === null) continue;
    lastDate = date;
    if (inWindow(date, window)) {
      days += 1;
      if (reached(value)) hit += 1;
    }
    if (!reached(value)) {
      run = null;
      continue;
    }
    if (run && daysBetween(run.end, date) === 1) {
      run.end = date;
      run.days += 1;
    } else {
      run = { start: date, end: date, days: 1 };
      runs.push(run);
    }
  }
  if (days === 0) return null;
  let longest: Streak | null = null;
  for (const candidate of runs) {
    if (candidate.end < window.from) continue;
    if (!longest || candidate.days >= longest.days) longest = candidate;
  }
  const last = runs[runs.length - 1];
  const current = last && last.end === lastDate && daysBetween(last.end, today) <= 1 && window.to === today ? { ...last } : null;
  return { hit, days, longest: longest ? { ...longest } : null, current };
}

function records(rows: readonly HealthDay[], window: DayWindow, moods: Map<DateString, InsightDay>): HealthRecord[] {
  const defs: { key: RecordKey; metric: HealthMetric; pickMax: boolean }[] = [
    { key: 'mostSteps', metric: 'steps', pickMax: true },
    { key: 'fewestSteps', metric: 'steps', pickMax: false },
    { key: 'longestSleep', metric: 'sleep', pickMax: true },
    { key: 'shortestSleep', metric: 'sleep', pickMax: false },
    { key: 'longestExercise', metric: 'exercise', pickMax: true },
    { key: 'lowestHr', metric: 'restingHr', pickMax: false },
    { key: 'highestHr', metric: 'restingHr', pickMax: true },
  ];
  const result: HealthRecord[] = [];
  for (const def of defs) {
    let best: { date: DateString; value: number } | null = null;
    for (const row of rows) {
      const date = row.date as DateString;
      if (!inWindow(date, window)) continue;
      const value = metricValue(row, def.metric);
      if (value === null || (def.metric === 'exercise' && value <= 0)) continue;
      // The newer day wins a tie, it is the one people remember.
      if (!best || (def.pickMax ? value >= best.value : value <= best.value)) best = { date, value };
    }
    if (best) result.push({ key: def.key, metric: def.metric, date: best.date, value: best.value, mood: moods.get(best.date)?.mean ?? null });
  }
  return result;
}

function moodSplit(rows: Map<string, HealthDay>, days: readonly InsightDay[], metric: HealthMetric): MoodSplit | null {
  const good: number[] = [];
  const hard: number[] = [];
  const all: number[] = [];
  for (const day of days) {
    const value = metricValue(rows.get(day.date), metric);
    if (value === null) continue;
    all.push(value);
    if (day.mean >= GOOD_MIN) good.push(value);
    else if (day.mean <= HARD_MAX) hard.push(value);
  }
  if (all.length === 0) return null;
  return { metric, good: mean(good), goodDays: good.length, hard: mean(hard), hardDays: hard.length, all: mean(all), allDays: all.length };
}

/** Pearson correlation; null when either side does not vary. */
export function correlation(pairs: readonly (readonly [number, number])[]): number | null {
  if (pairs.length < 2) return null;
  const mx = mean(pairs.map((p) => p[0]))!;
  const my = mean(pairs.map((p) => p[1]))!;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (const [x, y] of pairs) {
    sxy += (x - mx) * (y - my);
    sxx += (x - mx) ** 2;
    syy += (y - my) ** 2;
  }
  if (sxx === 0 || syy === 0) return null;
  return sxy / Math.sqrt(sxx * syy);
}

/**
 * The pairings worth asking about. Sleep belongs to the day it ends on, so "same" is the night
 * before the day and "nightAfter" the night that follows it. For the day values "next" pairs a
 * day's steps, pulse or training with the mood of the day after.
 */
export const LINK_PAIRINGS: Record<HealthMetric, LinkPairing[]> = {
  sleep: ['same', 'nightAfter'],
  steps: ['same', 'next'],
  restingHr: ['same', 'next'],
  exercise: ['same', 'next'],
};

function link(rows: Map<string, HealthDay>, days: readonly InsightDay[], moods: Map<DateString, InsightDay>, metric: HealthMetric, pairing: LinkPairing): HealthLink | null {
  const pairs: [number, number][] = [];
  for (const day of days) {
    if (pairing === 'same') {
      const value = metricValue(rows.get(day.date), metric);
      if (value !== null) pairs.push([value, day.mean]);
    } else if (pairing === 'nightAfter') {
      const value = metricValue(rows.get(addDaysToDateString(day.date, 1)), metric);
      if (value !== null) pairs.push([value, day.mean]);
    } else {
      const value = metricValue(rows.get(day.date), metric);
      const next = moods.get(addDaysToDateString(day.date, 1));
      if (value !== null && next) pairs.push([value, next.mean]);
    }
  }
  if (pairs.length < MIN_LINK_PAIRS) return null;
  const r = correlation(pairs);
  return r === null ? null : { metric, pairing, r, pairs: pairs.length };
}

/**
 * The metric on days with each activity against days without. Sleep is taken from the night after
 * the activity day, the other values from the same day. Same thresholds as the mood effects.
 */
export function activityHealth(rows: Map<string, HealthDay>, days: readonly InsightDay[], metric: HealthMetric, k: number = SHRINK_K): ActivityHealth {
  const pairs: { activities: ReadonlySet<number>; value: number }[] = [];
  for (const day of days) {
    const date = metric === 'sleep' ? addDaysToDateString(day.date, 1) : day.date;
    const value = metricValue(rows.get(date), metric);
    if (value !== null) pairs.push({ activities: day.activities, value });
  }
  const spread = standardDeviation(pairs.map((p) => p.value));
  if (!spread) return { lifts: [], lowers: [] };
  const ids = new Set<number>();
  for (const pair of pairs) for (const id of pair.activities) ids.add(id);
  const effects: ActivityHealthEffect[] = [];
  for (const activityId of ids) {
    const withValues: number[] = [];
    const withoutValues: number[] = [];
    for (const pair of pairs) (pair.activities.has(activityId) ? withValues : withoutValues).push(pair.value);
    if (withValues.length < MIN_SIDE_DAYS || withoutValues.length < MIN_SIDE_DAYS) continue;
    const withMean = mean(withValues)!;
    const withoutMean = mean(withoutValues)!;
    const difference = withMean - withoutMean;
    effects.push({
      activityId,
      withMean,
      withoutMean,
      withDays: withValues.length,
      withoutDays: withoutValues.length,
      difference,
      effect: (difference * shrinkFactor(Math.min(withValues.length, withoutValues.length), k)) / spread,
    });
  }
  return {
    lifts: effects.filter((e) => e.effect >= MIN_ACTIVITY_EFFECT).sort((a, b) => b.effect - a.effect || a.activityId - b.activityId),
    lowers: effects.filter((e) => e.effect <= -MIN_ACTIVITY_EFFECT).sort((a, b) => a.effect - b.effect || a.activityId - b.activityId),
  };
}

export function healthStats({ health, allDays, window, previous, today }: HealthStatsInput): HealthStats {
  const rows = [...health].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const rowByDate = new Map(rows.map((row) => [row.date, row]));
  const moods = byDate(allDays);
  const days = allDays.filter((day) => inWindow(day.date, window));

  const summaries: HealthStats['summaries'] = {};
  const metrics: HealthMetric[] = [];
  for (const metric of HEALTH_METRICS) {
    const s = summary(rows, metric, window, previous);
    // Exercise at 0 on every day means nothing records it; showing "0 min" would read as a fact.
    if (!s || (metric === 'exercise' && s.max <= 0)) continue;
    summaries[metric] = s;
    metrics.push(metric);
  }

  const result: HealthStats = {
    metrics,
    summaries,
    series: {},
    weekdays: {},
    goals: { sleep: null, steps: null, exercise: null },
    records: records(rows, window, moods).filter((record) => metrics.includes(record.metric)),
    moodSplits: [],
    links: [],
    activities: {},
    healthDays: rows.filter((row) => inWindow(row.date as DateString, window)).length,
    pairedDays: days.filter((day) => rowByDate.has(day.date)).length,
  };
  for (const metric of metrics) {
    result.series[metric] = series(rows, metric, window);
    result.weekdays[metric] = weekdays(rows, metric, window);
    const split = moodSplit(rowByDate, days, metric);
    if (split) result.moodSplits.push(split);
    for (const pairing of LINK_PAIRINGS[metric]) {
      const found = link(rowByDate, days, moods, metric, pairing);
      if (found) result.links.push(found);
    }
    result.activities[metric] = activityHealth(rowByDate, days, metric);
  }
  if (metrics.includes('sleep')) result.goals.sleep = goal(rows, 'sleep', (v) => v >= SLEEP_GOAL_MINUTES, window, today);
  if (metrics.includes('steps')) result.goals.steps = goal(rows, 'steps', (v) => v >= STEPS_GOAL, window, today);
  if (metrics.includes('exercise')) {
    const exercise = goal(rows, 'exercise', (v) => v > 0, window, today);
    const total = valuesIn(rows, window, 'exercise').reduce((sum, v) => sum + v, 0);
    // Weeks since the first health day in the window: before it nothing was recorded, not nothing done.
    const first = rows.find((row) => inWindow(row.date as DateString, window))!.date as DateString;
    const span = windowLength({ from: first, to: window.to });
    if (exercise) result.goals.exercise = { ...exercise, minutesPerWeek: (total / span) * 7 };
  }
  return result;
}
