/**
 * Day arithmetic on "YYYY-MM-DD" without date-fns or any other import, so the Node scripts can load
 * it too (Node strips the types itself, see `scripts/seasons.mjs`). `lib/dates` re-exports all of it.
 */

/** A calendar day as "YYYY-MM-DD". Compared lexicographically, never via timestamps. */
export type DateString = string & { readonly __brand: 'DateString' };

const MS_PER_DAY = 86_400_000;

/**
 * Days since the epoch, counted on the UTC calendar so there is no DST to trip over.
 * The engines call this thousands of times per render, which is why it skips date-fns.
 */
function dayNumber(value: DateString): number {
  return Date.UTC(Number(value.slice(0, 4)), Number(value.slice(5, 7)) - 1, Number(value.slice(8, 10))) / MS_PER_DAY;
}

/** The day `month` (1 to 12) and `day` of `year`, e.g. `dateOf(2026, 4, 5)` is "2026-04-05". */
export function dateOf(year: number, month: number, day: number): DateString {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` as DateString;
}

export function addDaysToDateString(value: DateString, days: number): DateString {
  return new Date((dayNumber(value) + days) * MS_PER_DAY).toISOString().slice(0, 10) as DateString;
}

export function compareDateStrings(a: DateString, b: DateString): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function daysBetween(from: DateString, to: DateString): number {
  return dayNumber(to) - dayNumber(from);
}

/** 0 = Sunday ... 6 = Saturday, like `Date.getDay`. */
export function weekdayOf(value: DateString): number {
  return (((dayNumber(value) + 4) % 7) + 7) % 7;
}
