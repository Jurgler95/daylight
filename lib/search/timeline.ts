import type { DateString } from '@/lib/dates';

export interface MonthSection<T> {
  /** First day of the month, "YYYY-MM-01". */
  month: DateString;
  data: T[];
}

/** Splits an already sorted list into one section per month, keeping the order. */
export function groupByMonth<T>(items: readonly T[], dateOf: (item: T) => DateString): MonthSection<T>[] {
  const sections: MonthSection<T>[] = [];
  for (const item of items) {
    const month = `${dateOf(item).slice(0, 7)}-01` as DateString;
    const last = sections[sections.length - 1];
    if (last && last.month === month) last.data.push(item);
    else sections.push({ month, data: [item] });
  }
  return sections;
}
