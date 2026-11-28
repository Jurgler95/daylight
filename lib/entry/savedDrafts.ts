import { isDateString } from '@/lib/dates';
import { isPhotoName } from '@/lib/photos/store';

import { sameDraft, type EntryDraft } from './draft';

/**
 * Drafts of the entry editor that outlive the app. Android may end the app in the background, on
 * the way to the camera for example; whatever was typed so far is kept here (`useEntryEditor`
 * writes it shortly after every change) and offered again on the next start or the next time the
 * same editor opens. A draft goes on "Speichern", on "Löschen" and on "Verwerfen".
 *
 * One small JSON text holds every draft, keyed by the editor it belongs to: a change to entry 12
 * never turns up in a new entry, nor a new entry for Monday in one for Tuesday. Where the text lives
 * is up to the caller (`draftFile.ts` in the app, a variable in tests). It stays on the device: it is
 * not in the database, so neither a backup nor an export ever sees it.
 */

/** Where the text lives. Reading gives null when there is none. */
export interface DraftStorage {
  read(): string | null;
  write(text: string): void;
  remove(): void;
}

export type DraftKey = `new:${string}` | `edit:${number}`;

/** Which editor a draft belongs to: a new entry, by the day its editor was opened for, or an entry being changed. */
export type DraftTarget = { kind: 'new'; date: string } | { kind: 'edit'; id: number };

export interface SavedDraft {
  key: DraftKey;
  draft: EntryDraft;
  /**
   * What the editor started from. A draft of an existing entry only fits while the entry is still
   * what it was: after a change elsewhere or an import that reused the id it is dropped, not
   * pasted over a different entry.
   */
  base: EntryDraft;
  /** Milliseconds since 1970, for the age limit and to offer the newest first. */
  savedAt: number;
}

/** Older drafts are dropped when read: by then nobody remembers what they were about. */
export const DRAFT_MAX_AGE_DAYS = 14;
/** How long after the last change the draft is written: typing does not write on every key. */
export const DRAFT_SAVE_DELAY_MS = 500;

const VERSION = 1;
const DAY_MS = 24 * 60 * 60 * 1000;

export function draftKey(target: DraftTarget): DraftKey {
  return target.kind === 'new' ? `new:${target.date}` : `edit:${target.id}`;
}

/** The editor a key belongs to, or null for a key that is no draft key. */
export function draftTarget(key: string): DraftTarget | null {
  const [kind, value] = key.split(':') as [string, string | undefined];
  if (kind === 'new' && value && isDateString(value)) return { kind: 'new', date: value };
  if (kind === 'edit' && value && /^\d+$/.test(value)) return { kind: 'edit', id: Number(value) };
  return null;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isId = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value > 0;

/** A draft as the editor holds it, or null when the value is anything else. */
export function parseEntryDraft(value: unknown): EntryDraft | null {
  if (!isRecord(value)) return null;
  const { date, time, mood_id, activity_ids, scales, note_title, note, photos, check_ins } = value;
  if (typeof date !== 'string' || !isDateString(date)) return null;
  if (typeof time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  if (mood_id !== null && !isId(mood_id)) return null;
  if (!Array.isArray(activity_ids) || !activity_ids.every(isId)) return null;
  if (!isRecord(scales) || !Object.entries(scales).every(([id, v]) => /^\d+$/.test(id) && typeof v === 'number' && Number.isFinite(v))) return null;
  if (typeof note_title !== 'string' || typeof note !== 'string') return null;
  if (!Array.isArray(photos) || !photos.every((name) => typeof name === 'string' && isPhotoName(name))) return null;
  if (!isRecord(check_ins) || !Object.entries(check_ins).every(([id, v]) => /^\d+$/.test(id) && (v === true || v === false || v === null))) return null;
  return {
    date,
    time,
    mood_id,
    activity_ids: [...new Set(activity_ids)],
    scales: Object.fromEntries(Object.entries(scales).map(([id, v]) => [Number(id), v as number])),
    note_title,
    note,
    photos: [...photos],
    check_ins: Object.fromEntries(Object.entries(check_ins).map(([id, v]) => [Number(id), v as boolean | null])),
  };
}

function parseSaved(value: unknown): SavedDraft | null {
  if (!isRecord(value) || typeof value.key !== 'string' || !draftTarget(value.key)) return null;
  const draft = parseEntryDraft(value.draft);
  const base = parseEntryDraft(value.base);
  if (!draft || !base || typeof value.savedAt !== 'number' || !Number.isFinite(value.savedAt)) return null;
  return { key: value.key as DraftKey, draft, base, savedAt: value.savedAt };
}

/** Every draft that is still young enough, newest first. A broken or unreadable text counts as none. */
export function readSavedDrafts(storage: DraftStorage, now: number = Date.now()): SavedDraft[] {
  let text: string | null;
  try {
    text = storage.read();
  } catch {
    return [];
  }
  if (!text) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return [];
  }
  if (!isRecord(parsed) || parsed.version !== VERSION || !Array.isArray(parsed.drafts)) return [];
  const drafts = parsed.drafts.map(parseSaved).filter((saved): saved is SavedDraft => saved !== null && now - saved.savedAt <= DRAFT_MAX_AGE_DAYS * DAY_MS);
  return drafts.sort((a, b) => b.savedAt - a.savedAt);
}

/** Never throws: a draft that cannot be written only means one less safety net. */
function writeAll(storage: DraftStorage, drafts: readonly SavedDraft[]): void {
  try {
    if (drafts.length === 0) storage.remove();
    else storage.write(JSON.stringify({ version: VERSION, drafts }));
  } catch {
    // Nothing to do: the editor keeps working on what it holds.
  }
}

export function readSavedDraft(storage: DraftStorage, key: DraftKey, now: number = Date.now()): SavedDraft | null {
  return readSavedDrafts(storage, now).find((saved) => saved.key === key) ?? null;
}

export function writeSavedDraft(storage: DraftStorage, key: DraftKey, draft: EntryDraft, base: EntryDraft, now: number = Date.now()): void {
  const others = readSavedDrafts(storage, now).filter((saved) => saved.key !== key);
  writeAll(storage, [{ key, draft, base, savedAt: now }, ...others]);
}

export function removeSavedDraft(storage: DraftStorage, key: DraftKey): void {
  const drafts = readSavedDrafts(storage);
  if (drafts.some((saved) => saved.key === key)) writeAll(storage, drafts.filter((saved) => saved.key !== key));
}

/** "Alle Daten löschen", or data replaced as a whole: no draft fits any more. */
export function removeAllSavedDrafts(storage: DraftStorage): void {
  writeAll(storage, []);
}

/** Photos a draft points to: picked into the photo folder already, but in no entry yet, so the cleanup must leave them. */
export function savedDraftPhotos(storage: DraftStorage): Set<string> {
  return new Set(readSavedDrafts(storage).flatMap((saved) => [...saved.draft.photos, ...saved.base.photos]));
}

export interface DraftFit {
  /** Moods, activities and scales that still exist; archived ones count, the editor shows them like in an old entry. */
  hasMood: (id: number) => boolean;
  hasActivity: (id: number) => boolean;
  hasScale: (id: number) => boolean;
  hasPhoto: (name: string) => boolean;
}

/** Leaves out what is gone since the draft was written, so saving it never fails on a missing row or file. */
export function fitDraft(draft: EntryDraft, fit: DraftFit): EntryDraft {
  return {
    ...draft,
    mood_id: draft.mood_id !== null && fit.hasMood(draft.mood_id) ? draft.mood_id : null,
    activity_ids: draft.activity_ids.filter(fit.hasActivity),
    scales: Object.fromEntries(Object.entries(draft.scales).filter(([id]) => fit.hasScale(Number(id)))),
    photos: draft.photos.filter(fit.hasPhoto),
  };
}

/**
 * The draft to offer when an editor opens on `initial`, or null. A draft of an existing entry only
 * while the entry is unchanged since; one that holds nothing beyond `initial` is not worth asking.
 */
export function restorableDraft(saved: SavedDraft | null, target: DraftTarget, initial: EntryDraft, fit: DraftFit): EntryDraft | null {
  if (!saved) return null;
  if (target.kind === 'edit' && !sameDraft(saved.base, initial)) return null;
  const draft = fitDraft(saved.draft, fit);
  return sameDraft(draft, initial) ? null : draft;
}

/** The route of the editor a draft belongs to, opening it on the draft right away. */
export function draftRoute(target: DraftTarget) {
  return target.kind === 'new'
    ? { pathname: '/entry/new' as const, params: { date: target.date, resume: '1' } }
    : { pathname: '/entry/[id]' as const, params: { id: String(target.id), resume: '1' } };
}

/** Runs `run` once `delay` ms have passed without another `schedule`; `flush` runs a pending one now. */
export function debounce(run: () => void, delay: number) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const cancel = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
  return {
    schedule: () => {
      cancel();
      timer = setTimeout(() => {
        timer = null;
        run();
      }, delay);
    },
    flush: () => {
      if (timer === null) return;
      cancel();
      run();
    },
    cancel,
    get pending() {
      return timer !== null;
    },
  };
}

/** For tests and as a fallback: the text in a variable. */
export function memoryDraftStorage(initial: string | null = null): DraftStorage & { text: string | null } {
  const storage = {
    text: initial,
    read: () => storage.text,
    write: (text: string) => void (storage.text = text),
    remove: () => void (storage.text = null),
  };
  return storage;
}

/**
 * How many editors are open right now. The offer on start stays away while one is (a reminder's link
 * opened it straight away); that editor offers its own draft.
 */
let openEditors = 0;
export function editorOpened(): () => void {
  openEditors++;
  let closed = false;
  return () => {
    if (closed) return;
    closed = true;
    openEditors--;
  };
}
export function editorsOpen(): number {
  return openEditors;
}
