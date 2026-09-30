import type { MoodLevel } from '@/db/schema';
import type { DateString } from '@/lib/dates';

/** The mood of one day: the mean of the levels of all its entries. */
export interface DayMood {
  date: DateString;
  /** Mean level, 1..5, not rounded. */
  mean: number;
  /** The mean rounded half up, which is what the calendar and the year pixels colour by. */
  level: MoodLevel;
  count: number;
}

/**
 * Half up, so a day of "Ok" and "Gut" counts as "Gut". A fixed rule, not banker's rounding, so the
 * same day always gets the same colour; clamped for safety against levels outside 1..5.
 */
export function roundLevel(mean: number): MoodLevel {
  return Math.min(5, Math.max(1, Math.floor(mean + 0.5))) as MoodLevel;
}

/** One `DayMood` per day that has entries, in the order the days first appear. */
export function dayMoods(entries: readonly { date: DateString; level: number }[]): Map<DateString, DayMood> {
  const sums = new Map<DateString, { sum: number; count: number }>();
  for (const entry of entries) {
    const day = sums.get(entry.date);
    if (day) {
      day.sum += entry.level;
      day.count += 1;
    } else sums.set(entry.date, { sum: entry.level, count: 1 });
  }
  const result = new Map<DateString, DayMood>();
  for (const [date, { sum, count }] of sums) {
    const mean = sum / count;
    result.set(date, { date, mean, level: roundLevel(mean), count });
  }
  return result;
}
