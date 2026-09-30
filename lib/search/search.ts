import type { MoodLevel } from '@/db/schema';
import { addDaysToDateString, type DateString } from '@/lib/dates';

import { fold, foldWithMap } from './fold';

export interface SearchableEntry {
  id: number;
  date: DateString;
  time: string;
  level: MoodLevel;
  mood_id: number;
  note_title: string | null;
  note: string | null;
  activity_ids: readonly number[];
  /** For the thumbnail in the timeline; not searched. */
  photos?: readonly string[];
}

/** Stored entries carry the date as a plain string; the search works on the branded day. */
export function toSearchable(entry: Omit<SearchableEntry, 'date'> & { date: string }): SearchableEntry {
  return { ...entry, date: entry.date as DateString };
}

export interface SearchLabels {
  activity: (id: number) => string | undefined;
  mood: (id: number) => string | undefined;
}

/** An entry with its searchable text folded once, so typing does not re-fold every note. */
export interface IndexedEntry {
  entry: SearchableEntry;
  note: string;
  title: string;
  mood: string;
  activities: { id: number; label: string }[];
}

export const PERIODS = ['all', '30', '90', '365'] as const;
export type Period = (typeof PERIODS)[number];

export interface SearchQuery {
  text: string;
  /** Activities that must all be on the entry. */
  activityIds: readonly number[];
  /** Mood levels the entry may have; empty means any. */
  levels: readonly MoodLevel[];
  period: Period;
}

export interface SearchHit {
  entry: SearchableEntry;
  /** Activities that matched a chip or the text, in the entry's order. */
  matchedActivityIds: number[];
  /** Note excerpt around the first text hit, the start of the note without one, null without a note. */
  snippet: string | null;
}

export const EMPTY_QUERY: SearchQuery = { text: '', activityIds: [], levels: [], period: 'all' };

/** Characters of note text kept around a hit. */
export const SNIPPET_LENGTH = 140;

export function isEmptyQuery(query: SearchQuery): boolean {
  return query.text.trim() === '' && query.activityIds.length === 0 && query.levels.length === 0 && query.period === 'all';
}

export function indexEntries(entries: readonly SearchableEntry[], labels: SearchLabels): IndexedEntry[] {
  return entries.map((entry) => ({
    entry,
    note: fold(entry.note ?? ''),
    title: fold(entry.note_title ?? ''),
    mood: fold(labels.mood(entry.mood_id) ?? ''),
    activities: entry.activity_ids.map((id) => ({ id, label: fold(labels.activity(id) ?? '') })),
  }));
}

/** First day of a period that ends today; null for "all". A 30-day period is today and the 29 before it. */
export function periodStart(period: Period, today: DateString): DateString | null {
  return period === 'all' ? null : addDaysToDateString(today, 1 - Number(period));
}

/**
 * Entries matching the query, newest first. Chips (activities) are combined with AND, levels with
 * OR. The text is split into words and every word has to appear somewhere in the entry: in the
 * note, its title, an activity or the mood. So "Familie Regen" finds a day with the activity
 * "Familie" and rain in the note, without picking the chip first.
 */
export function searchEntries(index: readonly IndexedEntry[], query: SearchQuery, today: DateString): SearchHit[] {
  const words = fold(query.text).split(/\s+/).filter(Boolean);
  const from = periodStart(query.period, today);
  const hits: SearchHit[] = [];

  for (const item of index) {
    const { entry } = item;
    if (from && entry.date < from) continue;
    if (query.levels.length > 0 && !query.levels.includes(entry.level)) continue;
    if (!query.activityIds.every((id) => entry.activity_ids.includes(id))) continue;

    const byText = new Set<number>();
    let noteWord: string | null = null;
    let matches = true;
    for (const word of words) {
      const activities = item.activities.filter((activity) => activity.label.includes(word));
      for (const activity of activities) byText.add(activity.id);
      const inNote = item.note.includes(word);
      if (inNote && noteWord === null) noteWord = word;
      if (!inNote && activities.length === 0 && !item.title.includes(word) && !item.mood.includes(word)) {
        matches = false;
        break;
      }
    }
    if (!matches) continue;

    hits.push({
      entry,
      matchedActivityIds: entry.activity_ids.filter((id) => query.activityIds.includes(id) || byText.has(id)),
      snippet: excerpt(entry.note, noteWord),
    });
  }

  return hits.sort((a, b) => compareNewestFirst(a.entry, b.entry));
}

export function compareNewestFirst(a: SearchableEntry, b: SearchableEntry): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  if (a.time !== b.time) return a.time < b.time ? 1 : -1;
  return b.id - a.id;
}

/** The most used activities first, for the filter chips. Ties keep the order of `activityIds`. */
export function topActivities(entries: readonly SearchableEntry[], activityIds: readonly number[], limit: number): number[] {
  const counts = new Map<number, number>();
  for (const entry of entries) for (const id of entry.activity_ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  return activityIds
    .filter((id) => (counts.get(id) ?? 0) > 0)
    .map((id, order) => ({ id, order, count: counts.get(id) ?? 0 }))
    .sort((a, b) => b.count - a.count || a.order - b.order)
    .slice(0, limit)
    .map((item) => item.id);
}

/** Note excerpt centred on the needle, or the beginning of the note when there is none. */
export function excerpt(note: string | null, needle: string | null): string | null {
  if (note === null || note.trim() === '') return null;
  const text = note.trim();
  if (text.length <= SNIPPET_LENGTH) return text;

  const { folded, map } = foldWithMap(text);
  const at = needle ? folded.indexOf(needle) : -1;
  if (at < 0) return `${text.slice(0, SNIPPET_LENGTH).trimEnd()}…`;

  const hit = map[at] ?? 0;
  const start = Math.max(0, hit - Math.floor(SNIPPET_LENGTH / 3));
  const end = Math.min(text.length, start + SNIPPET_LENGTH);
  return `${start > 0 ? '…' : ''}${text.slice(start, end).trim()}${end < text.length ? '…' : ''}`;
}
