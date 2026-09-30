import { addDaysToDateString } from '@/lib/dates';

import { byDate, type InsightDay } from './days';
import { shrinkFactor } from './stats';

/** A day counts as difficult at this rounded level or below ("Schlecht", "Lausig"). */
export const HARD_LEVEL = 2;
/** Days before a difficult day that are looked at. */
export const LOOKBACK_DAYS = 2;
/** Fewer difficult days than this and the card stays empty. */
export const MIN_HARD_DAYS = 3;
/** An activity has to show up before this many difficult days. */
export const MIN_BEFORE_HARD = 3;
/** And at least this much more often than before any day. */
export const MIN_BEFORE_RATIO = 1.25;
/** Shrinkage of the ratio; smaller than elsewhere because difficult days are rare by nature. */
export const BEFORE_HARD_K = 5;

export interface BeforeHard {
  activityId: number;
  /** Difficult days with the activity in the two days before. */
  hardDays: number;
  /** Share of difficult days with the activity in the two days before. */
  hardShare: number;
  /** Share of all days (with an entry in the two days before) with the activity in the two days before. */
  baseShare: number;
  /** `hardShare / baseShare`. */
  ratio: number;
  /** `ratio` pulled towards 1 by `shrinkFactor(hardDays)`; the list is sorted by it. */
  effect: number;
}

export interface BeforeHardResult {
  /** Difficult days that have at least one entry in the two days before. */
  hardDays: number;
  items: BeforeHard[];
}

/**
 * Activities that came up in the two days before difficult days more often than before days in
 * general. Every day with an entry in its two days before is a reference day, every difficult one
 * among them a target. An activity counts once per day, however often it came up in the two days.
 */
export function beforeHardDays(days: readonly InsightDay[], lookback: number = LOOKBACK_DAYS): BeforeHardResult {
  const lookup = byDate(days);
  let reference = 0;
  let hard = 0;
  const base = new Map<number, number>();
  const before = new Map<number, number>();
  for (const day of days) {
    const seen = new Set<number>();
    let logged = false;
    for (let back = 1; back <= lookback; back++) {
      const earlier = lookup.get(addDaysToDateString(day.date, -back));
      if (!earlier) continue;
      logged = true;
      for (const id of earlier.activities) seen.add(id);
    }
    if (!logged) continue;
    reference += 1;
    const isHard = day.level <= HARD_LEVEL;
    if (isHard) hard += 1;
    for (const id of seen) {
      base.set(id, (base.get(id) ?? 0) + 1);
      if (isHard) before.set(id, (before.get(id) ?? 0) + 1);
    }
  }
  if (hard < MIN_HARD_DAYS) return { hardDays: hard, items: [] };
  const items: BeforeHard[] = [];
  for (const [activityId, count] of before) {
    if (count < MIN_BEFORE_HARD) continue;
    const hardShare = count / hard;
    const baseShare = base.get(activityId)! / reference;
    const ratio = hardShare / baseShare;
    if (ratio < MIN_BEFORE_RATIO) continue;
    items.push({ activityId, hardDays: count, hardShare, baseShare, ratio, effect: 1 + (ratio - 1) * shrinkFactor(count, BEFORE_HARD_K) });
  }
  return { hardDays: hard, items: items.sort((a, b) => b.effect - a.effect || a.activityId - b.activityId) };
}
