import { addDaysToDateString, daysBetween, weekdayOf, type DateString } from '@/lib/dates';

import type { InsightDay } from './days';
import { mean, median, standardDeviation } from './stats';

/** A week needs this many days with entries before its spread says anything. */
export const MIN_WEEK_DAYS = 4;
/** How many of the calmest and the most unsettled weeks are named. */
export const SWING_WEEKS_SHOWN = 3;
/** A day counts towards a streak from this rounded level on ("Gut"). */
export const STREAK_MIN_LEVEL = 4;

export function weekStart(date: DateString, firstDay: number): DateString {
  return addDaysToDateString(date, -((weekdayOf(date) - firstDay + 7) % 7));
}

export interface WeekSwing {
  /** First day of the week. */
  start: DateString;
  mean: number;
  /** Population standard deviation of the day means in the week. */
  spread: number;
  days: number;
}

export interface Swings {
  /** Median spread of all weeks with enough days, null without any. */
  typical: number | null;
  weeks: number;
  /** Lowest spread first; ties go to the newer week. */
  calmest: WeekSwing[];
  /** Highest spread first; ties go to the newer week. */
  roughest: WeekSwing[];
}

/** How much the mood moved within each week, and the weeks at both ends. */
export function weeklySwings(days: readonly InsightDay[], firstDay: number): Swings {
  const weeks = new Map<DateString, number[]>();
  for (const day of days) {
    const start = weekStart(day.date, firstDay);
    const list = weeks.get(start);
    if (list) list.push(day.mean);
    else weeks.set(start, [day.mean]);
  }
  const swings: WeekSwing[] = [...weeks.entries()]
    .filter(([, values]) => values.length >= MIN_WEEK_DAYS)
    .map(([start, values]) => ({ start, mean: mean(values)!, spread: standardDeviation(values)!, days: values.length }));
  const newerFirst = (a: WeekSwing, b: WeekSwing) => (a.start < b.start ? 1 : -1);
  // With only a few weeks they are split between both lists, so no week is named twice.
  const calmest = [...swings].sort((a, b) => a.spread - b.spread || newerFirst(a, b)).slice(0, Math.min(SWING_WEEKS_SHOWN, Math.ceil(swings.length / 2)));
  const roughest = [...swings]
    .sort((a, b) => b.spread - a.spread || newerFirst(a, b))
    .filter((week) => !calmest.includes(week))
    .slice(0, SWING_WEEKS_SHOWN);
  return { typical: median(swings.map((week) => week.spread)), weeks: swings.length, calmest, roughest };
}

export interface Streak {
  start: DateString;
  end: DateString;
  days: number;
}

export interface Streaks {
  /**
   * The longest run of consecutive days at "Gut" or better that reaches `from` or later, counted in
   * full even where it began earlier; the newer one on a tie.
   */
  longest: Streak | null;
  /**
   * The run that is still going: it ends today, or yesterday while today has no entry yet. A day
   * without an entry ends a run, nothing more is made of it.
   */
  current: Streak | null;
}

export function goodStreaks(
  days: readonly InsightDay[],
  today: DateString,
  from: DateString | null = null,
  minLevel: number = STREAK_MIN_LEVEL,
): Streaks {
  const runs: Streak[] = [];
  let run: Streak | null = null;
  for (const day of days) {
    if (day.level < minLevel) {
      run = null;
      continue;
    }
    if (run && daysBetween(run.end, day.date) === 1) {
      run.end = day.date;
      run.days += 1;
    } else {
      run = { start: day.date, end: day.date, days: 1 };
      runs.push(run);
    }
  }
  let longest: Streak | null = null;
  for (const candidate of runs) {
    if (from !== null && candidate.end < from) continue;
    if (!longest || candidate.days >= longest.days) longest = candidate;
  }
  const last = runs[runs.length - 1];
  const lastDay = days[days.length - 1];
  const reachesNow = last && lastDay && last.end === lastDay.date && daysBetween(last.end, today) <= 1;
  return { longest: longest ? { ...longest } : null, current: reachesNow ? { ...last } : null };
}
