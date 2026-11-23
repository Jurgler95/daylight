import type { MoodLevel } from '@/db/schema';
import type { DateString } from '@/lib/dates';
import { dayMoods } from '@/lib/mood/dayMood';

/** What the insights need from one stored entry. `EntryDetails` fits as it is. */
export interface EntryFacts {
  date: string;
  time: string;
  level: number;
  activity_ids: readonly number[];
  note_title?: string | null;
  note?: string | null;
  scales?: readonly { scale_id: number; value: number }[];
}

/** All values one scale got on a day; whether they add up or average depends on its kind, see `scaleDayValue`. */
export interface ScaleDayValues {
  sum: number;
  count: number;
}

/**
 * One day with entries, the unit every insight counts in. A day with two entries counts once:
 * its mood is the mean of their levels (as in the calendar) and its activities are all activities
 * of all its entries.
 */
export interface InsightDay {
  date: DateString;
  /** Mean level, 1..5, not rounded. Every mean in the insights is a mean of these. */
  mean: number;
  /** `mean` rounded half up, for anything that sorts days into moods (distribution, pixels, streaks). */
  level: MoodLevel;
  /** Number of entries on the day. */
  count: number;
  activities: ReadonlySet<number>;
  /** By scale id; only scales with a value that day. */
  scales: ReadonlyMap<number, ScaleDayValues>;
}

/** Oldest day first. */
export function buildDays(entries: readonly EntryFacts[]): InsightDay[] {
  const moods = dayMoods(entries.map((entry) => ({ date: entry.date as DateString, level: entry.level })));
  const activities = new Map<string, Set<number>>();
  const scales = new Map<string, Map<number, ScaleDayValues>>();
  for (const entry of entries) {
    const set = activities.get(entry.date) ?? new Set<number>();
    for (const id of entry.activity_ids) set.add(id);
    activities.set(entry.date, set);
    if (!entry.scales?.length) continue;
    const values = scales.get(entry.date) ?? new Map<number, ScaleDayValues>();
    for (const { scale_id, value } of entry.scales) {
      const previous = values.get(scale_id);
      values.set(scale_id, { sum: (previous?.sum ?? 0) + value, count: (previous?.count ?? 0) + 1 });
    }
    scales.set(entry.date, values);
  }
  return [...moods.values()]
    .map((day) => ({
      date: day.date,
      mean: day.mean,
      level: day.level,
      count: day.count,
      activities: activities.get(day.date) ?? new Set<number>(),
      scales: scales.get(day.date) ?? new Map<number, ScaleDayValues>(),
    }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** Lookup by date, for the insights that look at neighbouring days. */
export function byDate(days: readonly InsightDay[]): Map<DateString, InsightDay> {
  return new Map(days.map((day) => [day.date, day]));
}

/** Notes and titles of one day joined, for the word counts. Empty when the day has no text. */
export function dayTexts(entries: readonly EntryFacts[]): Map<DateString, string> {
  const texts = new Map<DateString, string>();
  for (const entry of entries) {
    const text = [entry.note_title, entry.note].filter((part): part is string => !!part && part.trim() !== '').join('\n');
    if (!text) continue;
    const date = entry.date as DateString;
    const previous = texts.get(date);
    texts.set(date, previous ? `${previous}\n${text}` : text);
  }
  return texts;
}
