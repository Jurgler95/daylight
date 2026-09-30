import type { EntryDetails, EntryInput } from '@/db/repositories/entries';
import type { DateString } from '@/lib/dates';

/**
 * What the editor holds while it is open. Plain values only, so comparing it with the saved
 * entry tells whether closing would lose anything.
 */
export interface EntryDraft {
  date: DateString;
  time: string;
  mood_id: number | null;
  activity_ids: number[];
  /** scale id to value; a scale without a value is absent. */
  scales: Record<number, number>;
  note_title: string;
  note: string;
  /** Photo file names in display order; a picked photo is already in the photo folder. */
  photos: string[];
}

export function newDraft(date: DateString, time: string, moodId: number | null = null): EntryDraft {
  return { date, time, mood_id: moodId, activity_ids: [], scales: {}, note_title: '', note: '', photos: [] };
}

/**
 * Entries have no title any more; one from an older entry or a Daylio import is folded into the
 * first line of the note, so it stays visible and editable and is saved as note text.
 */
export function draftFromEntry(entry: EntryDetails): EntryDraft {
  const note = [entry.note_title, entry.note].filter((part) => part && part.trim() !== '').join('\n');
  return {
    date: entry.date as DateString,
    time: entry.time,
    mood_id: entry.mood_id,
    activity_ids: [...entry.activity_ids],
    scales: Object.fromEntries(entry.scales.map((scale) => [scale.scale_id, scale.value])),
    note_title: '',
    note,
    photos: [...entry.photos],
  };
}

/**
 * New entries on today get the current time. Earlier days get the reminder time, because that is
 * when a day is usually written down, and "now" would sort a late addition oddly into the past.
 */
export function defaultTime(date: DateString, today: DateString, nowTime: string, reminderTime: string): string {
  return date === today ? nowTime : reminderTime;
}

export function toggleId(list: readonly number[], id: number): number[] {
  return list.includes(id) ? list.filter((value) => value !== id) : [...list, id];
}

/** Sets or clears one scale value. */
export function setScale(scales: Readonly<Record<number, number>>, scaleId: number, value: number | null): Record<number, number> {
  const next = { ...scales };
  if (value === null) delete next[scaleId];
  else next[scaleId] = value;
  return next;
}

function sameSet(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((value) => b.includes(value));
}

function sameScales(a: Readonly<Record<number, number>>, b: Readonly<Record<number, number>>): boolean {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => a[Number(key)] === b[Number(key)]);
}

/** Text is compared trimmed, because that is how it is saved; activity order does not matter. */
export function sameDraft(a: EntryDraft, b: EntryDraft): boolean {
  return (
    a.date === b.date &&
    a.time === b.time &&
    a.mood_id === b.mood_id &&
    sameSet(a.activity_ids, b.activity_ids) &&
    sameScales(a.scales, b.scales) &&
    a.note_title.trim() === b.note_title.trim() &&
    a.note.trim() === b.note.trim() &&
    a.photos.length === b.photos.length &&
    a.photos.every((name, i) => b.photos[i] === name)
  );
}

/** What the repository saves, or null while no mood is picked (the one required field). */
export function draftToInput(draft: EntryDraft): EntryInput | null {
  if (draft.mood_id === null) return null;
  return {
    date: draft.date,
    time: draft.time,
    mood_id: draft.mood_id,
    note_title: draft.note_title.trim() || null,
    note: draft.note.trim() || null,
    activity_ids: draft.activity_ids,
    scales: Object.entries(draft.scales).map(([scale_id, value]) => ({ scale_id: Number(scale_id), value })),
    photos: draft.photos,
  };
}
