import { addDaysToDateString } from '@/lib/dates';

import { byDate, type InsightDay } from './days';
import { mean, shrinkFactor, SHRINK_K } from './stats';

/** Days needed on each side (with and without) before a comparison is shown at all. */
export const MIN_SIDE_DAYS = 5;
/** Shrunk differences smaller than this (a tenth of a mood step) are neither "lifts" nor "lowers". */
export const MIN_SHOWN_EFFECT = 0.1;

export interface ActivityEffect {
  activityId: number;
  /** Mean mood on days with the activity (or on the day after, with `lag` 1). */
  withMean: number;
  withoutMean: number;
  withDays: number;
  withoutDays: number;
  /** `withMean - withoutMean`, what the sentence shows. */
  difference: number;
  /**
   * `difference` times `shrinkFactor(min(withDays, withoutDays))`: what the lists sort by and what
   * the outlook adds for a planned or recurring activity. The smaller side limits how sure the
   * difference is, so an activity on almost every day is shrunk as much as a rare one.
   */
  effect: number;
}

export interface EffectOptions {
  /** 0: mood of the same day. 1: mood of the next day, for "am Folgetag". */
  lag?: 0 | 1;
  k?: number;
  minSide?: number;
}

/**
 * Mood on days with each activity against days without it. With `lag` 1 the activity is taken
 * from one day and the mood from the day after, and only pairs of two consecutive days with
 * entries count. Activities with fewer than `minSide` days on either side are left out.
 * Strongest `effect` first. Pure, on whatever days it is given, so the outlook's backtest can hand
 * in only the days up to its cut-off.
 */
export function activityEffects(days: readonly InsightDay[], options: EffectOptions = {}): ActivityEffect[] {
  const { lag = 0, k = SHRINK_K, minSide = MIN_SIDE_DAYS } = options;
  const lookup = lag ? byDate(days) : null;
  const pairs: { activities: ReadonlySet<number>; mood: number }[] = [];
  for (const day of days) {
    if (!lookup) pairs.push({ activities: day.activities, mood: day.mean });
    else {
      const next = lookup.get(addDaysToDateString(day.date, 1));
      if (next) pairs.push({ activities: day.activities, mood: next.mean });
    }
  }
  const ids = new Set<number>();
  for (const pair of pairs) for (const id of pair.activities) ids.add(id);

  const effects: ActivityEffect[] = [];
  for (const activityId of ids) {
    const withValues: number[] = [];
    const withoutValues: number[] = [];
    for (const pair of pairs) (pair.activities.has(activityId) ? withValues : withoutValues).push(pair.mood);
    if (withValues.length < minSide || withoutValues.length < minSide) continue;
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
      effect: difference * shrinkFactor(Math.min(withValues.length, withoutValues.length), k),
    });
  }
  return effects.sort((a, b) => b.effect - a.effect || a.activityId - b.activityId);
}

export interface SplitEffects {
  /** Strongest lift first. */
  lifts: ActivityEffect[];
  /** Strongest drop first. */
  lowers: ActivityEffect[];
}

export function splitEffects(effects: readonly ActivityEffect[], threshold: number = MIN_SHOWN_EFFECT): SplitEffects {
  return {
    lifts: effects.filter((e) => e.effect >= threshold).sort((a, b) => b.effect - a.effect),
    lowers: effects.filter((e) => e.effect <= -threshold).sort((a, b) => a.effect - b.effect),
  };
}

/** Effects by activity, the shape the outlook looks them up in. */
export function effectMap(effects: readonly ActivityEffect[]): Map<number, ActivityEffect> {
  return new Map(effects.map((effect) => [effect.activityId, effect]));
}
