import type { DateString } from '@/lib/dates';

/** Planned activity rows grouped by day, the shape the outlook reads them in. */
export function plansByDay(rows: readonly { date: string; activity_id: number }[]): Map<DateString, number[]> {
  const plans = new Map<DateString, number[]>();
  for (const row of rows) {
    const date = row.date as DateString;
    plans.set(date, [...(plans.get(date) ?? []), row.activity_id]);
  }
  return plans;
}
