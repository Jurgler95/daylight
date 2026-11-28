import { addDaysToDateString, type DateString } from '@/lib/dates';
import { MIN_SIDE_DAYS } from '@/lib/turning/compare';

import { startBounds } from './rules';

/**
 * Days with an entry the form would like to see before the start. The comparison itself begins at
 * `MIN_SIDE_DAYS` per side, but with fewer than about two weeks before the start one odd day weighs a
 * lot, and the noise check (`noise.ts`) has hardly any history to go on. A shorter experiment is
 * compared with an equally short stretch before it, so it never asks for more days than it lasts.
 */
export const BASELINE_DAYS = 14;

export interface Baseline {
  /** Days with an entry so far in the stretch "Davor" the comparison will use. */
  days: number;
  /** Days with an entry the form asks for before this start. */
  needed: number;
  /** Enough days before the start, counting the days until a start in the future as ones that will get an entry. */
  enough: boolean;
  /**
   * The earliest later start with enough days before it, counting every day from today on as one
   * that will get an entry. Null when there already are enough, or none lies within the start dates
   * the form allows.
   */
  later: DateString | null;
}

/** Days with an entry in the `length` days before `start`, like "Davor" in `compareExperiment`. */
function daysBefore(start: DateString, length: number, counts: (date: DateString) => boolean): number {
  let days = 0;
  for (let i = 1; i <= length; i++) if (counts(addDaysToDateString(start, -i))) days++;
  return days;
}

/** How much there is to compare a new experiment with, and when it would be better to begin. */
export function experimentBaseline(entryDates: ReadonlySet<string>, start: DateString, length: number, today: DateString): Baseline {
  const needed = Math.max(MIN_SIDE_DAYS, Math.min(BASELINE_DAYS, length));
  const willHave = (date: DateString) => entryDates.has(date) || date >= today;
  const days = daysBefore(start, length, (date) => entryDates.has(date));
  if (daysBefore(start, length, willHave) >= needed) return { days, needed, enough: true, later: null };
  const latest = startBounds(today).max;
  const first = addDaysToDateString(start, 1);
  for (let candidate = first > today ? first : today; candidate <= latest; candidate = addDaysToDateString(candidate, 1)) {
    if (daysBefore(candidate, length, willHave) >= needed) return { days, needed, enough: false, later: candidate };
  }
  return { days, needed, enough: false, later: null };
}
