import { daysBetween, weekdayOf, type DateString } from '@/lib/dates';
import { activityEffects, effectMap, weekdayProfile, type ActivityEffect, type InsightDay } from '@/lib/insights';

import { recurringActivities } from './recurring';

/** Half-lives in days of the two exponentially weighted means (specification: about 60 and 7). */
export const LONG_HALF_LIFE = 60;
export const RECENT_HALF_LIFE = 7;
/** The carry-over factor is the lag-1 autocorrelation, kept inside this range. */
export const MAX_PHI = 0.9;

/**
 * Everything the outlook learned from the diary up to its cut-off. Built only from days on or
 * before `cutoff`, so the backtest can fit it for any day in the past without seeing what came after.
 */
export interface OutlookModel {
  cutoff: DateString;
  /** Exponentially weighted mean, half-life 60 days. */
  longMean: number;
  /** Exponentially weighted mean, half-life 7 days. */
  recentMean: number;
  /** Lag-1 autocorrelation of the deviations from the mean, 0 to 0.9. */
  phi: number;
  /** Shrunk weekday effects from the insights, Sunday first. */
  weekdayEffects: readonly number[];
  /** Shrunk "with against without" effects from the insights. Missing below the minimum days. */
  effects: ReadonlyMap<number, ActivityEffect>;
  /** Share of recorded days of each weekday (Sunday first) that carry an activity. */
  weekdayShares: readonly ReadonlyMap<number, number>[];
  /** Days on or before the cut-off, for the recurring activities. */
  history: readonly InsightDay[];
}

function weightedMean(days: readonly InsightDay[], cutoff: DateString, halfLife: number): number {
  let sum = 0;
  let weights = 0;
  for (const day of days) {
    const weight = 0.5 ** (daysBetween(day.date, cutoff) / halfLife);
    sum += weight * day.mean;
    weights += weight;
  }
  return sum / weights;
}

/** Autocorrelation at one day over pairs of consecutive recorded days, 0 when it is undefined. */
function lagOneCorrelation(days: readonly InsightDay[]): number {
  let total = 0;
  for (const day of days) total += day.mean;
  const m = total / days.length;
  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < days.length - 1; i += 1) {
    const a = days[i]!;
    const b = days[i + 1]!;
    if (daysBetween(a.date, b.date) !== 1) continue;
    numerator += (a.mean - m) * (b.mean - m);
    denominator += (a.mean - m) ** 2;
  }
  if (denominator === 0) return 0;
  return Math.min(MAX_PHI, Math.max(0, numerator / denominator));
}

function sharesByWeekday(days: readonly InsightDay[]): Map<number, number>[] {
  const counts = Array.from({ length: 7 }, () => new Map<number, number>());
  const totals = Array.from({ length: 7 }, () => 0);
  for (const day of days) {
    const weekday = weekdayOf(day.date);
    totals[weekday]! += 1;
    for (const id of day.activities) counts[weekday]!.set(id, (counts[weekday]!.get(id) ?? 0) + 1);
  }
  return counts.map((map, weekday) => new Map([...map].map(([id, n]) => [id, n / totals[weekday]!])));
}

/**
 * Fits the model on the days up to and including `cutoff`. Later days in `days` are dropped
 * first, whatever the caller hands in. Null without a single day.
 */
export function fitModel(days: readonly InsightDay[], cutoff: DateString): OutlookModel | null {
  const history = days.filter((day) => day.date <= cutoff);
  if (history.length === 0) return null;
  return {
    cutoff,
    longMean: weightedMean(history, cutoff, LONG_HALF_LIFE),
    recentMean: weightedMean(history, cutoff, RECENT_HALF_LIFE),
    phi: lagOneCorrelation(history),
    weekdayEffects: weekdayProfile(history).weekdays.map((w) => w.effect),
    effects: effectMap(activityEffects(history)),
    weekdayShares: sharesByWeekday(history),
    history,
  };
}

export type ActivitySource = 'planned' | 'recurring' | 'skipped';

export interface ActivityPart {
  activityId: number;
  source: ActivitySource;
  /** Added to the expected value. */
  value: number;
}

export interface Expectation {
  date: DateString;
  /** Days after the cut-off. */
  horizon: number;
  /** Long mean plus the three parts below, not clamped. */
  value: number;
  longMean: number;
  carry: number;
  weekday: number;
  activities: ActivityPart[];
  /** Activities that recur on this weekday, whether or not a plan overrode them. */
  recurring: number[];
}

/**
 * Expected mood of `target`:
 *
 *   long mean + φ^h · (recent mean − long mean) + weekday effect + activities
 *
 * The weekday effect already contains the activities that are usual on that weekday. An activity
 * therefore only adds what differs from the usual: `effect · (x − share)`, with `share` the part
 * of past days of this weekday that had it and `x` 1 when it is planned (or recurring and nothing
 * is planned), 0 when a plan for the day leaves out a recurring one. Activities nobody knows about
 * add nothing. `planned` is null when the day has no plan; a plan overrides the recurring guess.
 */
export function expectDay(model: OutlookModel, target: DateString, planned: readonly number[] | null): Expectation {
  const horizon = daysBetween(model.cutoff, target);
  const weekday = weekdayOf(target);
  const carry = model.phi ** Math.max(horizon, 0) * (model.recentMean - model.longMean);
  const weekdayEffect = model.weekdayEffects[weekday] ?? 0;
  const recurring = recurringActivities(model.history, model.cutoff, target);
  const shares = model.weekdayShares[weekday]!;

  const present = new Map<number, ActivitySource>();
  if (planned) {
    for (const id of planned) present.set(id, 'planned');
    for (const id of recurring) if (!present.has(id)) present.set(id, 'skipped');
  } else {
    for (const id of recurring) present.set(id, 'recurring');
  }

  const activities: ActivityPart[] = [];
  for (const [activityId, source] of present) {
    const effect = model.effects.get(activityId);
    if (!effect) continue;
    const x = source === 'skipped' ? 0 : 1;
    activities.push({ activityId, source, value: effect.effect * (x - (shares.get(activityId) ?? 0)) });
  }
  activities.sort((a, b) => Math.abs(b.value) - Math.abs(a.value) || a.activityId - b.activityId);

  let value = model.longMean + carry + weekdayEffect;
  for (const part of activities) value += part.value;
  return { date: target, horizon, value, longMean: model.longMean, carry, weekday: weekdayEffect, activities, recurring };
}
