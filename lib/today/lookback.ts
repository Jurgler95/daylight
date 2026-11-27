import type { MoodLevel } from '@/db/schema';
import { addDaysToDateString, addMonthsToDateString, type DateString } from '@/lib/dates';
import { roundLevel } from '@/lib/mood/dayMood';

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

export interface LookbackEntry {
  id: number;
  mood_id: number;
  level: number;
  note_title?: string | null;
  note?: string | null;
}

export interface LookbackSummary {
  /** The day's mood as the calendar colours it: the mean of its entries, rounded half up. */
  level: MoodLevel;
  /** The latest entry's mood that sits on that level; null on a mixed day without one, which takes the level's own mood. */
  moodId: number | null;
  count: number;
  /** The note of the newest entry that has one, title and text joined; empty without any. */
  note: string;
  /** Newest first, for the day's photos. */
  entryIds: number[];
}

/**
 * One line for a day that may hold several entries, given oldest first: the day's mood like in the
 * calendar, the most recent note, every entry's photos. Null for a day without entries.
 */
export function summariseDay(entries: readonly LookbackEntry[]): LookbackSummary | null {
  if (entries.length === 0) return null;
  const newestFirst = [...entries].reverse();
  const level = roundLevel(entries.reduce((sum, entry) => sum + entry.level, 0) / entries.length);
  const text = (entry: LookbackEntry) => [entry.note_title, entry.note].filter((part) => part && part.trim() !== '').join(' ');
  return {
    level,
    moodId: newestFirst.find((entry) => entry.level === level)?.mood_id ?? null,
    count: entries.length,
    note: newestFirst.map(text).find((note) => note !== '') ?? '',
    entryIds: newestFirst.map((entry) => entry.id),
  };
}
