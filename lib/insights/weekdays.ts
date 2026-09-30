import { weekdayOf } from '@/lib/dates';

import type { InsightDay } from './days';
import { mean, shrinkFactor, SHRINK_K } from './stats';

export interface WeekdayStat {
  /** 0 = Sunday ... 6 = Saturday, like `weekdayOf`. */
  weekday: number;
  /** Mean of the day means on this weekday, null without days. */
  mean: number | null;
  days: number;
  /** `mean` minus the overall mean, null without days. */
  difference: number | null;
  /** `difference` pulled towards 0 by `shrinkFactor(days)`; 0 without days. What the outlook adds. */
  effect: number;
}

export interface WeekdayProfile {
  overall: number | null;
  /** Always seven, Sunday first; the screen reorders by the first day of the week. */
  weekdays: WeekdayStat[];
}

/**
 * Mean mood per weekday and how far it lies from the overall mean. Every day counts once, however
 * many entries it has. `effect` is the shrunk difference: with few Mondays on record the Monday
 * effect stays close to 0. Phase 4 adds it to the outlook as it is.
 */
export function weekdayProfile(days: readonly InsightDay[], k: number = SHRINK_K): WeekdayProfile {
  const overall = mean(days.map((day) => day.mean));
  const buckets: number[][] = Array.from({ length: 7 }, () => []);
  for (const day of days) buckets[weekdayOf(day.date)]!.push(day.mean);
  return {
    overall,
    weekdays: buckets.map((values, weekday) => {
      const m = mean(values);
      const difference = m === null || overall === null ? null : m - overall;
      return { weekday, mean: m, days: values.length, difference, effect: difference === null ? 0 : difference * shrinkFactor(values.length, k) };
    }),
  };
}

/** Sunday-first stats in display order for a week starting on `firstDay` (0 = Sunday, 1 = Monday). */
export function orderWeekdays<T extends { weekday: number }>(stats: readonly T[], firstDay: number): T[] {
  return [...stats].sort((a, b) => ((a.weekday - firstDay + 7) % 7) - ((b.weekday - firstDay + 7) % 7));
}
