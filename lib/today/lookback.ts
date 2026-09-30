import { addDaysToDateString, addMonthsToDateString, type DateString } from '@/lib/dates';

export type LookbackKey = 'week' | 'month' | 'halfYear' | 'year';

/**
 * The days "Heute" looks back to, nearest first. Months are calendar months, so the 31st looks
 * back to the last day of a shorter month (31. März, vor einem Monat: 28. oder 29. Februar).
 */
export function lookbackDays(date: DateString): { key: LookbackKey; date: DateString }[] {
  return [
    { key: 'week', date: addDaysToDateString(date, -7) },
    { key: 'month', date: addMonthsToDateString(date, -1) },
    { key: 'halfYear', date: addMonthsToDateString(date, -6) },
    { key: 'year', date: addMonthsToDateString(date, -12) },
  ];
}
