import type { MoodLevel } from '@/db/schema';
import { addDaysToDateString, type DateString } from '@/lib/dates';

import type { InsightDay } from './days';

export interface PixelMonth {
  /** "YYYY-MM-01". */
  month: DateString;
  /** One per day of the month, null for a day without entries. */
  levels: (MoodLevel | null)[];
}

/** Years that have at least one entry, newest first. */
export function pixelYears(days: readonly InsightDay[]): number[] {
  return [...new Set(days.map((day) => Number(day.date.slice(0, 4))))].sort((a, b) => b - a);
}

/** Twelve rows of one calendar year, a cell per day in the colour of its rounded mood. */
export function yearPixels(days: readonly InsightDay[], year: number): PixelMonth[] {
  const levels = new Map(days.map((day) => [day.date, day.level]));
  const months: PixelMonth[] = [];
  for (let day = `${year}-01-01` as DateString; day.startsWith(String(year)); day = addDaysToDateString(day, 1)) {
    const month = `${day.slice(0, 7)}-01` as DateString;
    const last = months[months.length - 1];
    const row = last && last.month === month ? last : { month, levels: [] };
    if (row !== last) months.push(row);
    row.levels.push(levels.get(day) ?? null);
  }
  return months;
}
