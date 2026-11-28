import type { MoodLevel } from '@/db/schema';
import { daysBetween, type DateString } from '@/lib/dates';

import type { InsightDay } from './days';
import { inWindow, type DayWindow } from './range';
import { mean } from './stats';

/**
 * The usual range: the mood levels a person picks on at least about half of their days. Someone who
 * chooses "Gut" on four days out of five has a flat line and months that all look alike; counted
 * against their own usual range, the few days above and below it stand out.
 *
 * The range is the level in the middle of the last twelve months, widened to the more frequent
 * neighbouring level until it holds half of the days. It only changes when it clearly stopped
 * fitting, so a single week does not move it. Pure, on whatever days it is given.
 */

/** Calendar days of history a day is measured against. */
export const USUAL_WINDOW_DAYS = 365;
/** Until this many logged days exist, the first ones are the reference, later ones included. */
export const USUAL_MIN_REFERENCE = 28;
/** Below this many logged days there is no usual range at all. */
export const USUAL_MIN_DAYS = 14;
/** The range stays while the range for `LOW` fits into it and it fits into the range for `HIGH`; else it becomes the one for `MID`. */
const SHARE_LOW = 0.45;
const SHARE_MID = 0.5;
const SHARE_HIGH = 0.55;

/** Both ends included. */
export interface UsualRange {
  lo: MoodLevel;
  hi: MoodLevel;
}

export type UsualPosition = 'below' | 'usual' | 'above';

/**
 * Index range `[a, b)` of the days day `i` is measured against, and the moved lower pointer: the
 * last 365 calendar days; with fewer than 28 logged days in them the last 28 logged days of any
 * age, or for the first 28 logged days those 28 (all of them in a shorter diary).
 */
function referenceBounds(numbers: readonly number[], i: number, from: number): [a: number, b: number, from: number] {
  let lo = from;
  while (numbers[i]! - numbers[lo]! >= USUAL_WINDOW_DAYS) lo++;
  const b = i + 1;
  if (b - lo >= USUAL_MIN_REFERENCE) return [lo, b, lo];
  return i < USUAL_MIN_REFERENCE ? [0, Math.min(numbers.length, USUAL_MIN_REFERENCE), lo] : [Math.max(0, b - USUAL_MIN_REFERENCE), b, lo];
}

/**
 * The lowest level whose cumulative share reaches half (not the textbook median of an even count),
 * widened towards the more frequent neighbour until it covers `threshold` of the days. With both
 * neighbours equally frequent it widens down when the mean level lies below the middle of the range.
 * `share` is indexed by level, 0 and 6 stay empty.
 */
function rangeFor(share: readonly number[], threshold: number): [lo: number, hi: number] {
  let cumulative = 0;
  let middle = 5;
  for (let level = 1; level <= 5; level++) {
    cumulative += share[level]!;
    if (cumulative >= 0.5 - 1e-12) {
      middle = level;
      break;
    }
  }
  let lo = middle;
  let hi = middle;
  let covered = share[middle]!;
  let meanLevel = 0;
  for (let level = 1; level <= 5; level++) meanLevel += level * share[level]!;
  while (covered < threshold - 1e-12 && (lo > 1 || hi < 5)) {
    const down = lo > 1 ? share[lo - 1]! : -1;
    const up = hi < 5 ? share[hi + 1]! : -1;
    if (down > up || (down === up && meanLevel < (lo + hi) / 2)) {
      lo -= 1;
      covered += down;
    } else {
      hi += 1;
      covered += up;
    }
  }
  return [lo, hi];
}

/**
 * The usual range that held on each day, in the order of `days` (oldest first, every day of the
 * diary: the range of a day depends on the one before it). Empty below `USUAL_MIN_DAYS` days.
 */
export function usualRanges(days: readonly InsightDay[]): UsualRange[] {
  if (days.length < USUAL_MIN_DAYS) return [];
  const first = days[0]!.date;
  const numbers = days.map((day) => daysBetween(first, day.date));
  const ranges: UsualRange[] = [];
  let from = 0;
  let current: [number, number] | null = null;
  for (let i = 0; i < days.length; i++) {
    const [a, b, moved] = referenceBounds(numbers, i, from);
    from = moved;
    const share = [0, 0, 0, 0, 0, 0, 0];
    // Added up day by day like the reference, so a share sitting right on a threshold falls the same way.
    for (let j = a; j < b; j++) share[days[j]!.level]! += 1 / (b - a);
    const small = rangeFor(share, SHARE_LOW);
    const big = rangeFor(share, SHARE_HIGH);
    if (current === null || !(current[0] <= small[0] && small[1] <= current[1] && big[0] <= current[0] && current[1] <= big[1])) {
      current = rangeFor(share, SHARE_MID);
    }
    ranges.push({ lo: current[0] as MoodLevel, hi: current[1] as MoodLevel });
  }
  return ranges;
}

/** Where a day's rounded level lies against the range that held that day. */
export function usualPosition(level: MoodLevel, range: UsualRange): UsualPosition {
  return level < range.lo ? 'below' : level > range.hi ? 'above' : 'usual';
}

export interface UsualMonth {
  /** "YYYY-MM-01". */
  month: DateString;
  /** Mean of the day means. */
  mean: number;
  days: number;
  /** Days below, inside and above the usual range of their day; null while there is no usual range. */
  usual: { below: number; within: number; above: number } | null;
}

export interface UsualView {
  /** The range on the last day with an entry inside the window; null without one or below `USUAL_MIN_DAYS` days. */
  range: UsualRange | null;
  /** One per calendar month with entries inside the window, oldest first. */
  months: UsualMonth[];
}

/**
 * Months of the window with their mean and their days below and above the usual range. The ranges
 * are worked out over the whole diary and only then cut to the window.
 */
export function usualView(allDays: readonly InsightDay[], window: DayWindow): UsualView {
  const ranges = usualRanges(allDays);
  const months = new Map<string, { means: number[]; below: number; within: number; above: number }>();
  let range: UsualRange | null = null;
  allDays.forEach((day, i) => {
    if (!inWindow(day.date, window)) return;
    const key = `${day.date.slice(0, 7)}-01`;
    const month = months.get(key) ?? { means: [], below: 0, within: 0, above: 0 };
    months.set(key, month);
    month.means.push(day.mean);
    const held = ranges[i];
    if (!held) return;
    range = held;
    const position = usualPosition(day.level, held);
    if (position === 'below') month.below += 1;
    else if (position === 'above') month.above += 1;
    else month.within += 1;
  });
  return {
    range,
    months: [...months.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([month, { means, below, within, above }]) => ({
        month: month as DateString,
        mean: mean(means)!,
        days: means.length,
        usual: ranges.length ? { below, within, above } : null,
      })),
  };
}
