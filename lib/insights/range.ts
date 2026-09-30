import { addDaysToDateString, daysBetween, type DateString } from '@/lib/dates';

import type { InsightDay } from './days';

/** The switch on top of "Einblicke". */
export const INSIGHT_RANGES = ['30', '90', '365', 'all'] as const;
export type InsightRange = (typeof INSIGHT_RANGES)[number];

/** Both ends included. */
export interface DayWindow {
  from: DateString;
  to: DateString;
}

/**
 * The window a range covers, ending today: 30 days is today and the 29 before. "All" starts with
 * the first entry (today without one), so its length is the length of the diary.
 */
export function rangeWindow(range: InsightRange, today: DateString, firstDate: DateString | null): DayWindow {
  if (range === 'all') return { from: firstDate && firstDate < today ? firstDate : today, to: today };
  return { from: addDaysToDateString(today, 1 - Number(range)), to: today };
}

export function windowLength(window: DayWindow): number {
  return daysBetween(window.from, window.to) + 1;
}

/**
 * The window of the same length right before, for "compared with before". Only when the diary
 * already ran through all of it: half a window of entries against a full one would show a trend
 * that is only the start of the diary. Never for "all", which has nothing before it.
 */
export function previousWindow(range: InsightRange, window: DayWindow, firstDate: DateString | null): DayWindow | null {
  if (range === 'all' || firstDate === null) return null;
  const length = windowLength(window);
  const previous = { from: addDaysToDateString(window.from, -length), to: addDaysToDateString(window.from, -1) };
  return firstDate <= previous.from ? previous : null;
}

export function inWindow(date: DateString, window: DayWindow): boolean {
  return date >= window.from && date <= window.to;
}

/** Days are sorted oldest first, the result keeps that order. */
export function daysIn(days: readonly InsightDay[], window: DayWindow): InsightDay[] {
  return days.filter((day) => inWindow(day.date, window));
}
