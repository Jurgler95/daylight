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
  /**
   * "Kept today?" for the experiments that ask on this day, by experiment id: only what changed
   * against the stored answers. True kept, false not kept (which ends the experiment with the save),
   * null takes a stored answer back. The answers belong to the day, so another day starts empty.
   */
  check_ins: Record<number, boolean | null>;
}

export function newDraft(date: DateString, time: string, moodId: number | null = null): EntryDraft {
  return { date, time, mood_id: moodId, activity_ids: [], scales: {}, note_title: '', note: '', photos: [], check_ins: {} };
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
    check_ins: {},
  };
}

/**
 * New entries on today get the current time. Earlier days get the reminder time (the latest one
 * when there are several), because that is when a day is usually written down, and "now" would sort
 * a late addition oddly into the past.
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

/** The answer the editor shows for an experiment: the change in the draft, else the stored one. */
export function checkInAnswer(checkIns: Readonly<Record<number, boolean | null>>, stored: ReadonlyMap<number, boolean>, id: number): boolean | null {
  return id in checkIns ? (checkIns[id] ?? null) : (stored.get(id) ?? null);
}

/**
 * A tap on Ja or Nein: picks the answer, or takes it back when it was the one shown. What equals the
 * stored answer again is no change any more, so it leaves the draft.
 */
export function tapCheckIn(
  checkIns: Readonly<Record<number, boolean | null>>,
  stored: ReadonlyMap<number, boolean>,
  id: number,
  kept: boolean,
): Record<number, boolean | null> {
  const next = { ...checkIns };
  const value = checkInAnswer(checkIns, stored, id) === kept ? null : kept;
  if (value === (stored.get(id) ?? null)) delete next[id];
  else next[id] = value;
  return next;
}

function sameCheckIns(a: Readonly<Record<number, boolean | null>>, b: Readonly<Record<number, boolean | null>>): boolean {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => Number(key) in b && a[Number(key)] === b[Number(key)]);
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
    a.photos.every((name, i) => b.photos[i] === name) &&
    sameCheckIns(a.check_ins, b.check_ins)
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
