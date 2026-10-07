import { and, asc, eq, gte, inArray, lte, min, ne } from 'drizzle-orm';

import type { DateString } from '@/lib/dates';

import { entries, entryActivities, entryScales, moods, turningPoints, type Entry, type EntrySource, type MoodLevel, type TurningPoint } from '../schema';
import type { Database } from '../types';
import { assertDate, assertTime, now, optionalText } from '../validate';
import { listPhotos, photosByEntry, setPhotos } from './photos';

export interface EntryInput {
  date: string;
  time: string;
  mood_id: number;
  note_title?: string | null;
  note?: string | null;
  source?: EntrySource;
  activity_ids?: readonly number[];
  scales?: readonly { scale_id: number; value: number }[];
  /** Photo file names in display order; the files must already be in the photo folder. */
  photos?: readonly string[];
}

/** An entry with everything hanging off it, as the screens, the export and the import read it. */
export interface EntryDetails extends Entry {
  level: MoodLevel;
  activity_ids: number[];
  scales: { scale_id: number; value: number }[];
  photos: string[];
}

function writeLinks(db: Database, entryId: number, input: Pick<EntryInput, 'activity_ids' | 'scales' | 'photos'>): void {
  if (input.activity_ids) {
    db.delete(entryActivities).where(eq(entryActivities.entry_id, entryId)).run();
    const ids = [...new Set(input.activity_ids)];
    if (ids.length) db.insert(entryActivities).values(ids.map((activity_id) => ({ entry_id: entryId, activity_id }))).run();
  }
  if (input.scales) {
    db.delete(entryScales).where(eq(entryScales.entry_id, entryId)).run();
    if (input.scales.length) db.insert(entryScales).values(input.scales.map((s) => ({ entry_id: entryId, ...s }))).run();
  }
  if (input.photos) setPhotos(db, entryId, input.photos);
}

/** Inserts the entry with its activities and scale values. Callers wrap several in a transaction. */
export function createEntry(db: Database, input: EntryInput): Entry {
  const entry = db
    .insert(entries)
    .values({
      date: assertDate(input.date),
      time: assertTime(input.time),
      mood_id: input.mood_id,
      note_title: optionalText(input.note_title),
      note: optionalText(input.note),
      source: input.source ?? 'app',
    })
    .returning()
    .get();
  writeLinks(db, entry.id, input);
  return entry;
}

/** Updates the given fields; `activity_ids` and `scales` replace the whole list when present. */
export function updateEntry(db: Database, id: number, patch: Partial<EntryInput>): Entry {
  return db.transaction((tx) => {
    const { activity_ids, scales, photos, ...fields } = patch;
    const values = {
      ...fields,
      ...(fields.date !== undefined && { date: assertDate(fields.date) }),
      ...(fields.time !== undefined && { time: assertTime(fields.time) }),
      ...(fields.note !== undefined && { note: optionalText(fields.note) }),
      ...(fields.note_title !== undefined && { note_title: optionalText(fields.note_title) }),
      updated_at: now(),
    };
    const before = getEntry(tx, id);
    const entry = tx.update(entries).set(values).where(eq(entries.id, id)).returning().get();
    writeLinks(tx, id, { activity_ids, scales, photos });
    if (before && before.date !== entry.date) dropOrphanTurningPoint(tx, before.date);
    return entry;
  });
}

/** Creates (`id` null) or replaces an entry with everything hanging off it, in one transaction. */
export function saveEntry(db: Database, id: number | null, input: EntryInput): Entry {
  if (id !== null) return updateEntry(db, id, input);
  return db.transaction((tx) => createEntry(tx, input));
}

/**
 * Deletes the entry; returns its photo file names, which the caller removes from disk. A turning
 * point hangs on a day with an entry, so it goes with the last entry of its day (the editor asks first).
 */
export function deleteEntry(db: Database, id: number): string[] {
  return db.transaction((tx) => {
    const photos = listPhotos(tx, id);
    const entry = getEntry(tx, id);
    tx.delete(entries).where(eq(entries.id, id)).run();
    if (entry) dropOrphanTurningPoint(tx, entry.date);
    return photos;
  });
}

/**
 * The turning point that deleting the entry (`newDate` undefined) or moving it to `newDate` would
 * remove, because it is the last entry of a turning point's day. For the editor to ask first.
 */
export function turningPointLostBy(db: Database, id: number, newDate?: string): TurningPoint | undefined {
  const entry = getEntry(db, id);
  if (!entry || entry.date === newDate || entryIdOnDate(db, entry.date, id) !== undefined) return undefined;
  return db.select().from(turningPoints).where(eq(turningPoints.date, entry.date)).get();
}

function dropOrphanTurningPoint(tx: Database, date: string): void {
  if (entryIdOnDate(tx, date) === undefined) tx.delete(turningPoints).where(eq(turningPoints.date, date)).run();
}

/** The first entry of a day, optionally other than `exceptId`, or undefined when the day has none. */
export function entryIdOnDate(db: Database, date: string, exceptId: number | null = null): number | undefined {
  return db
    .select({ id: entries.id })
    .from(entries)
    .where(and(eq(entries.date, date), exceptId !== null ? ne(entries.id, exceptId) : undefined))
    .orderBy(asc(entries.time), asc(entries.id))
    .get()?.id;
}

export function getEntry(db: Database, id: number): Entry | undefined {
  return db.select().from(entries).where(eq(entries.id, id)).get();
}

/** One entry with level, activity ids and scale values, or undefined when it is gone. */
export function getEntryDetails(db: Database, id: number): EntryDetails | undefined {
  const row = db.select({ entry: entries, level: moods.level }).from(entries).innerJoin(moods, eq(entries.mood_id, moods.id)).where(eq(entries.id, id)).get();
  if (!row) return undefined;
  return {
    ...row.entry,
    level: row.level as MoodLevel,
    activity_ids: db
      .select({ id: entryActivities.activity_id })
      .from(entryActivities)
      .where(eq(entryActivities.entry_id, id))
      .all()
      .map((link) => link.id),
    scales: db.select({ scale_id: entryScales.scale_id, value: entryScales.value }).from(entryScales).where(eq(entryScales.entry_id, id)).all(),
    photos: listPhotos(db, id),
  };
}

/** Oldest first; within a day by time, then by id. */
export function listEntries(db: Database, from?: string, to?: string): Entry[] {
  return db
    .select()
    .from(entries)
    .where(and(from ? gte(entries.date, from) : undefined, to ? lte(entries.date, to) : undefined))
    .orderBy(asc(entries.date), asc(entries.time), asc(entries.id))
    .all();
}

/** Same order as `listEntries`, with level, activity ids, scale values and photos attached. */
export function listEntryDetails(db: Database, from?: string, to?: string): EntryDetails[] {
  const rows = db
    .select({ entry: entries, level: moods.level })
    .from(entries)
    .innerJoin(moods, eq(entries.mood_id, moods.id))
    .where(and(from ? gte(entries.date, from) : undefined, to ? lte(entries.date, to) : undefined))
    .orderBy(asc(entries.date), asc(entries.time), asc(entries.id))
    .all();
  const links = new Map<number, number[]>();
  for (const link of db.select().from(entryActivities).all()) {
    const list = links.get(link.entry_id);
    if (list) list.push(link.activity_id);
    else links.set(link.entry_id, [link.activity_id]);
  }
  const values = new Map<number, { scale_id: number; value: number }[]>();
  for (const { entry_id, scale_id, value } of db.select().from(entryScales).all()) {
    const list = values.get(entry_id);
    if (list) list.push({ scale_id, value });
    else values.set(entry_id, [{ scale_id, value }]);
  }
  const photos = photosByEntry(db);
  return rows.map(({ entry, level }) => ({
    ...entry,
    level: level as MoodLevel,
    activity_ids: links.get(entry.id) ?? [],
    scales: values.get(entry.id) ?? [],
    photos: photos.get(entry.id) ?? [],
  }));
}

/** Mood and note of every entry on the given days, oldest first; for the look back on "Heute". */
export function listEntriesOnDates(db: Database, dates: readonly string[]) {
  if (dates.length === 0) return [];
  return db
    .select({ id: entries.id, date: entries.date, time: entries.time, mood_id: entries.mood_id, level: moods.level, note_title: entries.note_title, note: entries.note })
    .from(entries)
    .innerJoin(moods, eq(entries.mood_id, moods.id))
    .where(inArray(entries.date, [...dates]))
    .orderBy(asc(entries.date), asc(entries.time), asc(entries.id))
    .all();
}

/** Just what the calendar draws: day, time, mood and its level, for every entry. */
export function listEntryMoods(db: Database): { date: DateString; time: string; mood_id: number; level: number }[] {
  return db
    .select({ date: entries.date, time: entries.time, mood_id: entries.mood_id, level: moods.level })
    .from(entries)
    .innerJoin(moods, eq(entries.mood_id, moods.id))
    .all() as { date: DateString; time: string; mood_id: number; level: number }[];
}

export function firstEntryDate(db: Database): DateString | null {
  const row = db.select({ value: min(entries.date) }).from(entries).get();
  return (row?.value as DateString | null | undefined) ?? null;
}

/** Whether the day has at least one entry, for the reminder that stays away once there is one. */
export function hasEntryOn(db: Database, date: string): boolean {
  return db.select({ id: entries.id }).from(entries).where(eq(entries.date, date)).limit(1).get() !== undefined;
}
