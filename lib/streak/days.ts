import { addDaysToDateString, type DateString } from '@/lib/dates';

/**
 * The days a streak counts: every day with at least one entry, whatever the mood and however late
 * it was written. Days after today only get in through an import and count nowhere, neither here
 * nor for the achievements, which share this set.
 */
export function entryDaysUpTo(dates: Iterable<string>, today: DateString): Set<DateString> {
  const days = new Set<DateString>();
  for (const date of dates) if (date <= today) days.add(date as DateString);
  return days;
}

/** Length of the run of consecutive days in `days` that ends on `end`; 0 when `end` itself is missing. */
export function runEndingAt(days: ReadonlySet<string>, end: DateString): number {
  let length = 0;
  let day = end;
  while (days.has(day)) {
    length += 1;
    day = addDaysToDateString(day, -1);
  }
  return length;
}
