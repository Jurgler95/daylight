import { MOOD_LEVELS, type MoodLevel } from '@/db/schema';
import { addDaysToDateString, type DateString } from '@/lib/dates';

import type { InsightDay } from './days';
import { inWindow, type DayWindow } from './range';
import { mean } from './stats';

/** Days, counting back from and including the day itself, that the smooth line averages over. */
export const ROLLING_DAYS = 7;

export interface MoodPoint {
  date: DateString;
  /** The day's mean level. */
  mean: number;
  /** Mean of the days with entries among this day and the six before it, also before the window. */
  rolling: number;
}

/**
 * The mood line: one point per day with entries inside the window. The rolling mean looks back
 * across the window start, so the line does not start with a jump; gaps simply have fewer days in
 * their week.
 */
export function moodSeries(days: readonly InsightDay[], window: DayWindow): MoodPoint[] {
  const points: MoodPoint[] = [];
  let start = 0;
  for (let i = 0; i < days.length; i++) {
    const day = days[i]!;
    if (day.date > window.to) break;
    const earliest = addDaysToDateString(day.date, 1 - ROLLING_DAYS);
    while (days[start]!.date < earliest) start++;
    if (!inWindow(day.date, window)) continue;
    const rolling = mean(days.slice(start, i + 1).map((d) => d.mean)) ?? day.mean;
    points.push({ date: day.date, mean: day.mean, rolling });
  }
  return points;
}

export interface LevelShare {
  level: MoodLevel;
  days: number;
  /** 0..1 of the days in the window. */
  share: number;
  /** Share in the window before, null without a comparable one. */
  previousShare: number | null;
}

/** Days per mood level (rounded day mean), best level first, with the window before for comparison. */
export function moodDistribution(days: readonly InsightDay[], previous: readonly InsightDay[] | null): LevelShare[] {
  const count = (list: readonly InsightDay[], level: MoodLevel) => list.filter((day) => day.level === level).length;
  return [...MOOD_LEVELS].reverse().map((level) => {
    const n = count(days, level);
    return {
      level,
      days: n,
      share: days.length ? n / days.length : 0,
      previousShare: previous && previous.length ? count(previous, level) / previous.length : null,
    };
  });
}

export interface MonthMean {
  /** "YYYY-MM-01". */
  month: DateString;
  mean: number;
  days: number;
}

/** Mean per calendar month that has entries, oldest first. */
export function monthMeans(days: readonly InsightDay[]): MonthMean[] {
  const months = new Map<string, number[]>();
  for (const day of days) {
    const key = `${day.date.slice(0, 7)}-01`;
    const list = months.get(key);
    if (list) list.push(day.mean);
    else months.set(key, [day.mean]);
  }
  return [...months.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([month, values]) => ({ month: month as DateString, mean: mean(values)!, days: values.length }));
}

/** Mean of all day means, null without days. */
export function overallMean(days: readonly InsightDay[]): number | null {
  return mean(days.map((day) => day.mean));
}
