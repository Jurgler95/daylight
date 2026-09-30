import { MOOD_LEVELS, type MoodLevel } from '@/db/schema';
import { addMonthsToDateString, type DateString, weekdayOf } from '@/lib/dates';

import type { InsightDay } from './days';
import { activityEffects, type ActivityEffect } from './effects';
import { mean } from './stats';

/** Companions and typical activities named on a detail page. */
export const DETAIL_ROWS = 6;

export interface LevelCount {
  level: MoodLevel;
  days: number;
  share: number;
}

function levelCounts(days: readonly InsightDay[]): LevelCount[] {
  return [...MOOD_LEVELS].reverse().map((level) => {
    const n = days.filter((day) => day.level === level).length;
    return { level, days: n, share: days.length ? n / days.length : 0 };
  });
}

export interface ActivityDetail {
  /** Days with the activity, newest first. */
  days: InsightDay[];
  /** Share of all days with entries. */
  share: number;
  withLevels: LevelCount[];
  withoutLevels: LevelCount[];
  withMean: number | null;
  withoutMean: number | null;
  /** Null below the minimum days on either side, as on "Einblicke". */
  sameDay: ActivityEffect | null;
  nextDay: ActivityEffect | null;
  /** Sunday first: days with the activity and their share of all days with entries on that weekday. */
  weekdays: { weekday: number; days: number; share: number }[];
  /** What else was logged on those days, most frequent first. */
  companions: { activityId: number; days: number; share: number }[];
  /** Every month from the first to the last entry, oldest first, with how many days had the activity. */
  months: { month: DateString; days: number; loggedDays: number }[];
}

/** Everything on record about one activity, over the whole diary. */
export function activityDetail(days: readonly InsightDay[], activityId: number): ActivityDetail {
  const withDays = days.filter((day) => day.activities.has(activityId));
  const withoutDays = days.filter((day) => !day.activities.has(activityId));
  const find = (lag: 0 | 1) => activityEffects(days, { lag }).find((effect) => effect.activityId === activityId) ?? null;

  const weekdayTotals = Array.from({ length: 7 }, () => 0);
  const weekdayHits = Array.from({ length: 7 }, () => 0);
  for (const day of days) weekdayTotals[weekdayOf(day.date)]! += 1;
  for (const day of withDays) weekdayHits[weekdayOf(day.date)]! += 1;

  const companionCounts = new Map<number, number>();
  for (const day of withDays) for (const id of day.activities) if (id !== activityId) companionCounts.set(id, (companionCounts.get(id) ?? 0) + 1);

  const months: ActivityDetail['months'] = [];
  const first = days[0];
  const last = days[days.length - 1];
  if (first && last) {
    const logged = new Map<string, number>();
    const hits = new Map<string, number>();
    for (const day of days) logged.set(day.date.slice(0, 7), (logged.get(day.date.slice(0, 7)) ?? 0) + 1);
    for (const day of withDays) hits.set(day.date.slice(0, 7), (hits.get(day.date.slice(0, 7)) ?? 0) + 1);
    const end = `${last.date.slice(0, 7)}-01`;
    for (let month = `${first.date.slice(0, 7)}-01` as DateString; month <= end; month = addMonthsToDateString(month, 1)) {
      const key = month.slice(0, 7);
      months.push({ month, days: hits.get(key) ?? 0, loggedDays: logged.get(key) ?? 0 });
    }
  }

  return {
    days: [...withDays].reverse(),
    share: days.length ? withDays.length / days.length : 0,
    withLevels: levelCounts(withDays),
    withoutLevels: levelCounts(withoutDays),
    withMean: mean(withDays.map((day) => day.mean)),
    withoutMean: mean(withoutDays.map((day) => day.mean)),
    sameDay: find(0),
    nextDay: find(1),
    weekdays: weekdayTotals.map((total, weekday) => ({ weekday, days: weekdayHits[weekday]!, share: total ? weekdayHits[weekday]! / total : 0 })),
    companions: [...companionCounts.entries()]
      .map(([id, n]) => ({ activityId: id, days: n, share: n / withDays.length }))
      .sort((a, b) => b.days - a.days || a.activityId - b.activityId)
      .slice(0, DETAIL_ROWS),
    months,
  };
}

/** Days at the level with the activity needed before it counts as typical. */
export const MIN_LEVEL_ACTIVITY_DAYS = 3;
/** Other days with the activity needed before it counts as rare at this level. */
export const MIN_OTHER_ACTIVITY_DAYS = 5;
/** Ratios beyond these bounds are named. */
export const TYPICAL_RATIO = 1.25;
export const RARE_RATIO = 0.8;

export interface LevelActivity {
  activityId: number;
  /** Days at this level with the activity, and its share of all days at this level. */
  days: number;
  share: number;
  /** Share of all other days that had the activity. */
  otherShare: number;
  /** Smoothed `share / otherShare`. */
  ratio: number;
}

export interface LevelDetail {
  level: MoodLevel;
  days: number;
  /** Share of all days with entries. */
  share: number;
  /** More common at this level than on other days, strongest first. */
  typical: LevelActivity[];
  /** Less common at this level, rarest first. */
  rare: LevelActivity[];
}

/**
 * Which activities go with one mood level, compared with every other day. Ratios use add-one
 * smoothing, so a level with three days does not produce a ratio of 30.
 */
export function levelDetail(days: readonly InsightDay[], level: MoodLevel): LevelDetail {
  const at = days.filter((day) => day.level === level);
  const other = days.length - at.length;
  const atCounts = new Map<number, number>();
  const otherCounts = new Map<number, number>();
  for (const day of days) {
    const counts = day.level === level ? atCounts : otherCounts;
    for (const id of day.activities) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const rows: LevelActivity[] = [...new Set([...atCounts.keys(), ...otherCounts.keys()])].map((activityId) => {
    const n = atCounts.get(activityId) ?? 0;
    const o = otherCounts.get(activityId) ?? 0;
    return {
      activityId,
      days: n,
      share: at.length ? n / at.length : 0,
      otherShare: other ? o / other : 0,
      ratio: (n + 1) / (at.length + 2) / ((o + 1) / (other + 2)),
    };
  });
  const enough = at.length > 0 && other > 0;
  return {
    level,
    days: at.length,
    share: days.length ? at.length / days.length : 0,
    typical: enough
      ? rows
          .filter((row) => row.days >= MIN_LEVEL_ACTIVITY_DAYS && row.ratio >= TYPICAL_RATIO)
          .sort((a, b) => b.ratio - a.ratio || a.activityId - b.activityId)
          .slice(0, DETAIL_ROWS)
      : [],
    rare: enough
      ? rows
          .filter((row) => (otherCounts.get(row.activityId) ?? 0) >= MIN_OTHER_ACTIVITY_DAYS && row.ratio <= RARE_RATIO)
          .sort((a, b) => a.ratio - b.ratio || a.activityId - b.activityId)
          .slice(0, DETAIL_ROWS)
      : [],
  };
}
