import { createTestDb } from '@/db/testDb';
import type { DateString } from '@/lib/dates';
import { memoryPhotoStore, sweepPhotos } from '@/lib/photos/store';

import { newDraft, type EntryDraft } from '../draft';
import {
  debounce,
  DRAFT_MAX_AGE_DAYS,
  draftKey,
  draftRoute,
  draftTarget,
  fitDraft,
  memoryDraftStorage,
  parseEntryDraft,
  readSavedDraft,
  readSavedDrafts,
  removeAllSavedDrafts,
  removeSavedDraft,
  restorableDraft,
  savedDraftPhotos,
  writeSavedDraft,
  type DraftFit,
} from '../savedDrafts';

const day = '2026-11-27' as DateString;
const base = newDraft(day, '20:30');
const typed: EntryDraft = {
  ...base,
  mood_id: 3,
  activity_ids: [4, 7],
  scales: { 2: 6 },
  note: 'Langer Spaziergang am Fluss',
  photos: ['photo-abc-123456.jpg'],
  check_ins: { 9: true },
};
// Real time: removing reads with the clock, and old drafts are dropped on reading.
const NOW = Date.now();
const everything: DraftFit = { hasMood: () => true, hasActivity: () => true, hasScale: () => true, hasPhoto: () => true };

describe('saved drafts', () => {
  it('keeps one draft per editor, newest first, and leaves the others alone', () => {
    const storage = memoryDraftStorage();
    writeSavedDraft(storage, 'new:2026-11-27', typed, base, NOW);
    writeSavedDraft(storage, 'edit:12', { ...typed, note: 'geändert' }, typed, NOW + 1000);
    writeSavedDraft(storage, 'new:2026-11-27', { ...typed, note: 'noch mehr' }, base, NOW + 2000);
    expect(readSavedDrafts(storage, NOW + 3000).map((saved) => saved.key)).toEqual(['new:2026-11-27', 'edit:12']);
    expect(readSavedDraft(storage, 'new:2026-11-27', NOW + 3000)?.draft.note).toBe('noch mehr');
    // An edit of entry 12 never shows up in a new entry, nor a new entry for one day in another.
    expect(readSavedDraft(storage, 'new:2026-11-26', NOW + 3000)).toBeNull();
    expect(readSavedDraft(storage, 'edit:13', NOW + 3000)).toBeNull();

    removeSavedDraft(storage, 'new:2026-11-27');
    expect(readSavedDrafts(storage, NOW + 3000).map((saved) => saved.key)).toEqual(['edit:12']);
    removeSavedDraft(storage, 'edit:12');
    // The last one takes the file with it.
    expect(storage.text).toBeNull();
  });

  it('comes back exactly as it was written', () => {
    const storage = memoryDraftStorage();
    writeSavedDraft(storage, 'new:2026-11-27', typed, base, NOW);
    expect(readSavedDraft(storage, 'new:2026-11-27', NOW)).toEqual({ key: 'new:2026-11-27', draft: typed, base, savedAt: NOW });
  });

  it('drops drafts older than two weeks', () => {
    const storage = memoryDraftStorage();
    writeSavedDraft(storage, 'edit:1', typed, base, NOW);
    expect(readSavedDrafts(storage, NOW + DRAFT_MAX_AGE_DAYS * 24 * 3600 * 1000)).toHaveLength(1);
    expect(readSavedDrafts(storage, NOW + DRAFT_MAX_AGE_DAYS * 24 * 3600 * 1000 + 1)).toHaveLength(0);
  });

  it('treats a broken, foreign or unreadable file as no draft', () => {
    expect(readSavedDrafts(memoryDraftStorage('{nope'), NOW)).toEqual([]);
    expect(readSavedDrafts(memoryDraftStorage(JSON.stringify({ version: 99, drafts: [] })), NOW)).toEqual([]);
    const throwing = { read: () => { throw new Error('io'); }, write: () => { throw new Error('io'); }, remove: () => { throw new Error('io'); } };
    expect(readSavedDrafts(throwing, NOW)).toEqual([]);
    expect(() => writeSavedDraft(throwing, 'edit:1', typed, base, NOW)).not.toThrow();
    expect(() => removeAllSavedDrafts(throwing)).not.toThrow();
    // One bad draft does not take the good ones with it.
    const mixed = JSON.stringify({ version: 1, drafts: [{ key: 'edit:1', draft: { ...typed, photos: ['../../etc/passwd'] }, base, savedAt: NOW }, { key: 'edit:2', draft: typed, base, savedAt: NOW }] });
    expect(readSavedDrafts(memoryDraftStorage(mixed), NOW).map((saved) => saved.key)).toEqual(['edit:2']);
  });

  it('checks every field of a draft', () => {
    expect(parseEntryDraft(typed)).toEqual(typed);
    expect(parseEntryDraft({ ...typed, date: '27.11.2026' })).toBeNull();
    expect(parseEntryDraft({ ...typed, time: '25:00' })).toBeNull();
    expect(parseEntryDraft({ ...typed, mood_id: 'gut' })).toBeNull();
    expect(parseEntryDraft({ ...typed, activity_ids: [1, -2] })).toBeNull();
    expect(parseEntryDraft({ ...typed, scales: { 2: 'viel' } })).toBeNull();
    expect(parseEntryDraft({ ...typed, note: null })).toBeNull();
    expect(parseEntryDraft({ ...typed, check_ins: { 9: 'ja' } })).toBeNull();
    expect(parseEntryDraft(null)).toBeNull();
  });

  it('lists the photos drafts point to, for the cleanup on start', () => {
    const storage = memoryDraftStorage();
    writeSavedDraft(storage, 'edit:5', typed, { ...base, photos: ['photo-old-000000.jpg'] }, Date.now());
    expect(savedDraftPhotos(storage)).toEqual(new Set(['photo-abc-123456.jpg', 'photo-old-000000.jpg']));
    removeAllSavedDrafts(storage);
    expect(savedDraftPhotos(storage)).toEqual(new Set());
  });

  it('keeps the photos of a draft through the cleanup on start', () => {
    const storage = memoryDraftStorage();
    writeSavedDraft(storage, 'new:2026-11-27', typed, base, Date.now());
    const photos = memoryPhotoStore({ 'photo-abc-123456.jpg': new Uint8Array([1]), 'photo-left-000000.jpg': new Uint8Array([2]) });
    expect(sweepPhotos(createTestDb(), photos, savedDraftPhotos(storage))).toBe(1);
    expect([...photos.files.keys()]).toEqual(['photo-abc-123456.jpg']);
  });

  it('leaves out what is gone since', () => {
    const fitted = fitDraft(typed, { hasMood: () => false, hasActivity: (id) => id === 7, hasScale: () => false, hasPhoto: () => false });
    expect(fitted).toMatchObject({ mood_id: null, activity_ids: [7], scales: {}, photos: [], note: typed.note, check_ins: typed.check_ins });
  });

  it('offers a draft only when it adds something, and one of an entry only while the entry is unchanged', () => {
    const saved = { key: 'edit:12' as const, draft: typed, base, savedAt: NOW };
    expect(restorableDraft(saved, { kind: 'edit', id: 12 }, base, everything)).toEqual(typed);
    // The entry was changed elsewhere, or the id now belongs to another entry after an import.
    expect(restorableDraft(saved, { kind: 'edit', id: 12 }, { ...base, note: 'anders' }, everything)).toBeNull();
    // A new entry starts at another time every time; its draft still counts.
    expect(restorableDraft({ ...saved, key: 'new:2026-11-27' }, { kind: 'new', date: day }, { ...base, time: '21:00' }, everything)).toEqual(typed);
    expect(restorableDraft({ ...saved, draft: base }, { kind: 'edit', id: 12 }, base, everything)).toBeNull();
    expect(restorableDraft(null, { kind: 'edit', id: 12 }, base, everything)).toBeNull();
  });

  it('turns keys into editors and routes and back', () => {
    expect(draftKey({ kind: 'new', date: day })).toBe('new:2026-11-27');
    expect(draftKey({ kind: 'edit', id: 12 })).toBe('edit:12');
    expect(draftTarget('new:2026-11-27')).toEqual({ kind: 'new', date: day });
    expect(draftTarget('edit:12')).toEqual({ kind: 'edit', id: 12 });
    expect(draftTarget('edit:x')).toBeNull();
    expect(draftTarget('new:gestern')).toBeNull();
    expect(draftRoute({ kind: 'new', date: day })).toEqual({ pathname: '/entry/new', params: { date: day, resume: '1' } });
    expect(draftRoute({ kind: 'edit', id: 12 })).toEqual({ pathname: '/entry/[id]', params: { id: '12', resume: '1' } });
  });
});

describe('debounce', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('runs once after the last call, now on flush, and never after cancel', () => {
    const run = jest.fn();
    const saver = debounce(run, 500);
    saver.schedule();
    jest.advanceTimersByTime(400);
    saver.schedule();
    jest.advanceTimersByTime(400);
    expect(run).not.toHaveBeenCalled();
    jest.advanceTimersByTime(100);
    expect(run).toHaveBeenCalledTimes(1);

    saver.schedule();
    saver.flush();
    expect(run).toHaveBeenCalledTimes(2);
    saver.flush();
    jest.advanceTimersByTime(1000);
    expect(run).toHaveBeenCalledTimes(2);

    saver.schedule();
    saver.cancel();
    jest.advanceTimersByTime(1000);
    expect(run).toHaveBeenCalledTimes(2);
  });
});
