/**
 * Turning points are rare on purpose: a handful of days that changed something, not a tag for any
 * day. The cap counts the calendar year of the turning point's own date, not when it was set, so it
 * needs nothing stored beyond the rows and survives a backup.
 */
export const TURNING_POINTS_PER_YEAR = 4;

export function yearOf(date: string): string {
  return date.slice(0, 4);
}

/** How many turning points fall into each calendar year. */
export function countByYear(dates: Iterable<string>): Map<string, number> {
  const counts = new Map<string, number>();
  for (const date of dates) counts.set(yearOf(date), (counts.get(yearOf(date)) ?? 0) + 1);
  return counts;
}

/**
 * The turning points whose day has an entry. Deleting the last entry of a day leaves its turning
 * point behind, so a backup may carry one; an import drops it instead of refusing the whole file.
 */
export function onEntryDays<T extends { date: string }>(points: readonly T[], entries: readonly { date: string }[]): T[] {
  const days = new Set(entries.map((entry) => entry.date));
  return points.filter((point) => days.has(point.date));
}

/** How many more fit into the year of `date`. */
export function roomInYear(dates: Iterable<string>, date: string): number {
  return Math.max(0, TURNING_POINTS_PER_YEAR - (countByYear(dates).get(yearOf(date)) ?? 0));
}
