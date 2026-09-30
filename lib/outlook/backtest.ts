import { addDaysToDateString, type DateString } from '@/lib/dates';
import { byDate, mean, type InsightDay } from '@/lib/insights';
import { roundLevel } from '@/lib/mood/dayMood';

import { expectDay, fitModel } from './model';

/** Days ahead the outlook looks: tomorrow up to a week. */
export const HORIZONS = [1, 2, 3, 4, 5, 6, 7] as const;
/** Below this many days with an entry there is no outlook and no backtest. */
export const MIN_OUTLOOK_DAYS = 30;
/** A horizon needs this many backtest cases before its score counts at all. */
export const MIN_BACKTEST_CASES = 20;
/**
 * The backtest steps through at most this many cut-offs, the most recent ones. Each fits the whole
 * model again, so the cost grows with the square of the diary; a year of cut-offs is plenty to judge.
 */
export const MAX_ORIGINS = 365;

/** One backtest forecast: made on `origin` with the days up to it, compared with what happened. */
export interface BacktestCase {
  origin: DateString;
  target: DateString;
  horizon: number;
  actual: number;
  /** The model's expected value, unrounded. The spread around it comes from `actual − model`. */
  model: number;
  /** What the outlook shows as its middle: the expected value rounded to a mood level. */
  level: number;
  /** Naive comparison: the long mean alone (the model without its three parts). */
  longMean: number;
  /** Naive comparison: the most frequent mood level so far. */
  mode: number;
}

export interface HorizonScore {
  horizon: number;
  cases: number;
  /** Mean absolute errors in mood steps, null without cases. `model` scores the level shown as the middle. */
  model: number | null;
  /** The same for the unrounded expected value. Reported, not used for the decision. */
  expected: number | null;
  longMean: number | null;
  mode: number | null;
  /** True when the shown level is strictly better than both comparisons, over enough cases. */
  beats: boolean;
  /** `actual − model`, sorted ascending. The spread shown around an expected value comes from here. */
  residuals: number[];
}

export interface BacktestResult {
  origins: number;
  horizons: HorizonScore[];
}

/** Most frequent rounded level; a tie goes to the level closest to the mean, then the higher one. */
export function mostFrequentLevel(days: readonly InsightDay[]): number {
  const counts = new Map<number, number>();
  for (const day of days) counts.set(day.level, (counts.get(day.level) ?? 0) + 1);
  const m = mean(days.map((day) => day.mean)) ?? 3;
  let best = 3;
  let bestCount = -1;
  for (const [level, n] of counts) {
    const closer = Math.abs(level - m) < Math.abs(best - m) || (Math.abs(level - m) === Math.abs(best - m) && level > best);
    if (n > bestCount || (n === bestCount && closer)) {
      best = level;
      bestCount = n;
    }
  }
  return best;
}

/** The cut-offs the backtest steps through: from the 30th recorded day to the day before the last, the most recent `maxOrigins`. */
export function backtestOrigins(days: readonly InsightDay[], maxOrigins: number = MAX_ORIGINS): DateString[] {
  if (days.length < MIN_OUTLOOK_DAYS) return [];
  const last = days[days.length - 1]!.date;
  const origins: DateString[] = [];
  for (let origin = days[MIN_OUTLOOK_DAYS - 1]!.date; origin < last; origin = addDaysToDateString(origin, 1)) origins.push(origin);
  return origins.slice(-maxOrigins);
}

/**
 * The cases of one cut-off: the model fitted on the days up to `origin` only, asked for the seven
 * days after it; each of those days that has an entry becomes a case.
 */
export function casesForOrigin(days: readonly InsightDay[], origin: DateString, lookup: ReadonlyMap<DateString, InsightDay> = byDate(days)): BacktestCase[] {
  let end = 0;
  while (end < days.length && days[end]!.date <= origin) end += 1;
  const history = days.slice(0, end);
  const model = fitModel(history, origin);
  if (!model) return [];
  const mode = mostFrequentLevel(history);
  const cases: BacktestCase[] = [];
  for (const horizon of HORIZONS) {
    const target = addDaysToDateString(origin, horizon);
    const actual = lookup.get(target);
    if (!actual) continue;
    const value = expectDay(model, target, null).value;
    cases.push({ origin, target, horizon, actual: actual.mean, model: value, level: roundLevel(value), longMean: model.longMean, mode });
  }
  return cases;
}

/**
 * Rolling-origin backtest over every cut-off of `backtestOrigins`. No plans exist for the past, so
 * the model runs on its weekday rhythm, carry-over and recurring activities alone.
 */
export function backtestCases(days: readonly InsightDay[], maxOrigins: number = MAX_ORIGINS): BacktestCase[] {
  const lookup = byDate(days);
  return backtestOrigins(days, maxOrigins).flatMap((origin) => casesForOrigin(days, origin, lookup));
}

/**
 * A key per cut-off that changes whenever anything the cut-off's cases depend on changes: the days
 * up to seven days after it. Lets the app keep the cases of all older cut-offs when today's entry
 * is saved, and refit only the last week of cut-offs.
 */
export function originKeys(days: readonly InsightDay[], origins: readonly DateString[]): string[] {
  const prefix: number[] = [];
  let hash = 2166136261;
  for (const day of days) {
    const text = `${day.date}:${day.mean}:${[...day.activities].sort((a, b) => a - b).join(',')};`;
    for (let i = 0; i < text.length; i += 1) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619) >>> 0;
    prefix.push(hash);
  }
  let end = 0;
  return origins.map((origin) => {
    const until = addDaysToDateString(origin, HORIZONS[HORIZONS.length - 1]!);
    while (end < days.length && days[end]!.date <= until) end += 1;
    return `${origin}#${end}#${end ? prefix[end - 1] : 0}`;
  });
}

function mae(cases: readonly BacktestCase[], pick: (c: BacktestCase) => number): number | null {
  return mean(cases.map((c) => Math.abs(c.actual - pick(c))));
}

/**
 * Mean absolute error per horizon for the model and both comparisons, and whether the model wins.
 * The model is judged by what the outlook shows, the middle as a mood level: an icon and a colour,
 * never a decimal. The absolute error is smallest for the median, and where one level dominates
 * that level is the median, so an unrounded mean would lose to it on almost every day.
 */
export function scoreBacktest(cases: readonly BacktestCase[]): BacktestResult {
  const origins = new Set(cases.map((c) => c.origin)).size;
  const horizons = HORIZONS.map((horizon): HorizonScore => {
    const own = cases.filter((c) => c.horizon === horizon);
    const model = mae(own, (c) => c.level);
    const expected = mae(own, (c) => c.model);
    const longMean = mae(own, (c) => c.longMean);
    const mode = mae(own, (c) => c.mode);
    const beats = own.length >= MIN_BACKTEST_CASES && model !== null && longMean !== null && mode !== null && model < longMean && model < mode;
    return { horizon, cases: own.length, model, expected, longMean, mode, beats, residuals: own.map((c) => c.actual - c.model).sort((a, b) => a - b) };
  });
  return { origins, horizons };
}

export function backtest(days: readonly InsightDay[], maxOrigins: number = MAX_ORIGINS): BacktestResult {
  return scoreBacktest(backtestCases(days, maxOrigins));
}

/** Value at quantile `q` (0..1) of an ascending list, linearly interpolated. */
export function quantile(sorted: readonly number[], q: number): number | null {
  if (sorted.length === 0) return null;
  const position = (sorted.length - 1) * Math.min(1, Math.max(0, q));
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return sorted[lower]! + (sorted[upper]! - sorted[lower]!) * (position - lower);
}
