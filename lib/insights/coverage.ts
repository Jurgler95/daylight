import { daysBetween, type DateString } from '@/lib/dates';

import type { EntryFacts } from './days';
import { inWindow, type DayWindow } from './range';
import { median } from './stats';

export interface Coverage {
  entries: number;
  days: number;
  /** Days from the later of window start and first entry to the window end. */
  spanDays: number;
  /** `days / spanDays`, 0..1. */
  share: number;
  /** Median time of day as "HH:mm", with the day turning at 04:00 so late nights stay together. */
  typicalTime: string;
  /** Entries per hour of the day, 24 values. */
  hours: number[];
}

const minutesOf = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
/** Entries before this hour belong to the evening before when the typical time is taken. */
const DAY_TURN_HOUR = 4;
const MINUTES_PER_DAY = 24 * 60;
/** Minutes counted from 04:00, so 23:50 and 00:10 lie next to each other rather than a day apart. */
const shifted = (time: string) => (minutesOf(time) - DAY_TURN_HOUR * 60 + MINUTES_PER_DAY) % MINUTES_PER_DAY;
const pad = (n: number) => String(n).padStart(2, '0');

/**
 * How much of the window the diary covers. The span starts at the first entry if that lies inside
 * the window, so a diary begun last week is not "20 % covered" over 30 days. Null without entries.
 */
export function coverage(entries: readonly EntryFacts[], window: DayWindow, firstDate: DateString | null): Coverage | null {
  const inside = entries.filter((entry) => inWindow(entry.date as DateString, window));
  if (inside.length === 0 || firstDate === null) return null;
  const from = firstDate > window.from ? firstDate : window.from;
  const spanDays = daysBetween(from, window.to) + 1;
  const days = new Set(inside.map((entry) => entry.date)).size;
  const hours = Array.from({ length: 24 }, () => 0);
  for (const entry of inside) hours[Math.floor(minutesOf(entry.time) / 60) % 24]! += 1;
  const typical = (Math.round(median(inside.map((entry) => shifted(entry.time)))!) + DAY_TURN_HOUR * 60) % MINUTES_PER_DAY;
  return {
    entries: inside.length,
    days,
    spanDays,
    share: Math.min(1, days / spanDays),
    typicalTime: `${pad(Math.floor(typical / 60))}:${pad(typical % 60)}`,
    hours,
  };
}
