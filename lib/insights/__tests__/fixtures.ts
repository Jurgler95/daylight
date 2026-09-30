import type { DateString } from '@/lib/dates';

import { buildDays, type EntryFacts, type InsightDay } from '../days';

export const d = (value: string) => value as DateString;

/** One entry: day, level, activity ids, optional note. */
export function entry(date: string, level: number, activities: number[] = [], note: string | null = null, time = '20:30'): EntryFacts {
  return { date, time, level, activity_ids: activities, note_title: null, note };
}

/** Consecutive days from `start`, one entry each, with the given levels and activities. */
export function run(start: string, levels: number[], activities: (number[] | undefined)[] = []): EntryFacts[] {
  const base = Date.UTC(Number(start.slice(0, 4)), Number(start.slice(5, 7)) - 1, Number(start.slice(8, 10)));
  return levels.map((level, i) => entry(new Date(base + i * 86_400_000).toISOString().slice(0, 10), level, activities[i] ?? []));
}

export function days(entries: EntryFacts[]): InsightDay[] {
  return buildDays(entries);
}
