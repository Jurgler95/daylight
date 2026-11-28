import { act, renderHook } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';

import type { Database } from '@/db';
import { createEntry, listActivities, listEntries, listMoods, updateEntry } from '@/db/repositories';
import { createActivity } from '@/db/repositories/activities';
import { listGroups } from '@/db/repositories/groups';
import { createTestDb } from '@/db/testDb';
import type { DateString } from '@/lib/dates';
import { useDataVersion } from '@/lib/store/dataVersion';
import { useSettingsStore } from '@/lib/store/settingsStore';

import { DRAFT_SAVE_DELAY_MS, memoryDraftStorage, readSavedDraft, readSavedDrafts } from '../savedDrafts';
import { useEntryEditor, type EditorTarget } from '../useEntryEditor';

/** The editor keeps what was typed on the device, offers it again in the same editor only, and lets it go on save or discard. */
let mockDb: Database | null = null;
jest.mock('@/db/client', () => ({ getDb: () => mockDb, DATABASE_NAME: 'test.db' }));
jest.mock('@/lib/dates/useToday', () => ({ useToday: () => '2026-09-26' }));
// Created inside the factory: it runs while the imports above load, before any const of this file.
jest.mock('@/lib/entry/draftFile', () => ({ fileDraftStorage: jest.requireActual('../savedDrafts').memoryDraftStorage() }));
const mockStorage = jest.requireMock('@/lib/entry/draftFile').fileDraftStorage as ReturnType<typeof memoryDraftStorage>;

const day = '2026-09-20' as DateString;
const newOn = (date: DateString): EditorTarget => ({ kind: 'new', date, moodId: null });
let appStateListeners: ((state: AppStateStatus) => void)[] = [];

function open(target: EditorTarget) {
  return renderHook(() => useEntryEditor(target));
}

async function wait(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
}

describe('saved drafts in the entry editor', () => {
  let mood: number;
  // Fake for the whole file: switching back and forth between tests leaves React's scheduler on the wrong clock.
  beforeAll(() => jest.useFakeTimers());
  afterAll(() => jest.useRealTimers());
  beforeEach(() => {
    mockStorage.text = null;
    mockDb = createTestDb();
    useDataVersion.getState().bump();
    useSettingsStore.getState().load();
    mood = listMoods(mockDb)[2]!.id;
    appStateListeners = [];
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
      appStateListeners.push(listener as (state: AppStateStatus) => void);
      return { remove: () => undefined } as ReturnType<typeof AppState.addEventListener>;
    });
  });
  afterEach(() => jest.restoreAllMocks());

  it('keeps a new entry a moment after the last change and offers it in the next editor for that day', async () => {
    const first = await open(newOn(day));
    await act(async () => first.result.current.update({ mood_id: mood, note: 'Langer Spaziergang' }));
    expect(mockStorage.text).toBeNull();
    await wait(DRAFT_SAVE_DELAY_MS);
    expect(readSavedDraft(mockStorage, 'new:2026-09-20')?.draft).toMatchObject({ mood_id: mood, note: 'Langer Spaziergang' });
    // Android ends the app: nothing unmounts, nothing is cleaned up.

    const second = await open(newOn(day));
    expect(second.result.current.savedDraft).toBe(true);
    expect(second.result.current.draft?.note).toBe('');
    await act(async () => second.result.current.resumeSaved());
    expect(second.result.current.savedDraft).toBe(false);
    expect(second.result.current.draft).toMatchObject({ mood_id: mood, note: 'Langer Spaziergang' });
    expect(second.result.current.dirty).toBe(true);

    await act(async () => {
      second.result.current.save();
    });
    expect(listEntries(mockDb!)).toHaveLength(1);
    expect(mockStorage.text).toBeNull();
  });

  it('writes nothing while the offer is open, and "Verwerfen" deletes the draft', async () => {
    const first = await open(newOn(day));
    await act(async () => first.result.current.update({ note: 'Notiz' }));
    await wait(DRAFT_SAVE_DELAY_MS);
    const second = await open(newOn(day));
    await wait(DRAFT_SAVE_DELAY_MS * 2);
    expect(readSavedDraft(mockStorage, 'new:2026-09-20')?.draft.note).toBe('Notiz');
    await act(async () => second.result.current.discardSaved());
    expect(mockStorage.text).toBeNull();
    expect(second.result.current.draft?.note).toBe('');
  });

  it('opens straight on the draft when the offer on start sent it', async () => {
    const first = await open(newOn(day));
    await act(async () => first.result.current.update({ mood_id: mood }));
    await wait(DRAFT_SAVE_DELAY_MS);
    const second = await open({ ...newOn(day), resume: true });
    expect(second.result.current.savedDraft).toBe(false);
    expect(second.result.current.draft?.mood_id).toBe(mood);
  });

  it('writes at once when the app leaves the front', async () => {
    const editor = await open(newOn(day));
    await act(async () => editor.result.current.update({ note: 'Gerade getippt' }));
    expect(mockStorage.text).toBeNull();
    await act(async () => {
      appStateListeners.forEach((listener) => listener('background'));
    });
    expect(readSavedDraft(mockStorage, 'new:2026-09-20')?.draft.note).toBe('Gerade getippt');
  });

  it('lets the draft go when the changes are undone or discarded', async () => {
    const editor = await open(newOn(day));
    await act(async () => editor.result.current.update({ note: 'x' }));
    await wait(DRAFT_SAVE_DELAY_MS);
    expect(mockStorage.text).not.toBeNull();
    await act(async () => editor.result.current.update({ note: '' }));
    expect(mockStorage.text).toBeNull();

    await act(async () => editor.result.current.update({ note: 'y' }));
    await wait(DRAFT_SAVE_DELAY_MS);
    await act(async () => editor.result.current.discard());
    expect(mockStorage.text).toBeNull();
  });

  it('keeps a change to an entry apart from new entries, and drops it once the entry changed elsewhere', async () => {
    const entry = createEntry(mockDb!, { date: day, time: '20:00', mood_id: mood, note: 'Alt' });
    const edit = await open({ kind: 'edit', id: entry.id });
    await act(async () => edit.result.current.update({ note: 'Neu' }));
    await wait(DRAFT_SAVE_DELAY_MS);
    expect(readSavedDrafts(mockStorage).map((saved) => saved.key)).toEqual([`edit:${entry.id}`]);

    // Not in a new entry of the same day.
    const fresh = await open(newOn(day));
    expect(fresh.result.current.savedDraft).toBe(false);
    // Offered for the same entry.
    const again = await open({ kind: 'edit', id: entry.id });
    expect(again.result.current.savedDraft).toBe(true);
    await again.unmount();

    // Changed in the meantime (or the id now belongs to an imported entry): the draft would paste over it.
    updateEntry(mockDb!, entry.id, { note: 'Woanders geändert' });
    const later = await open({ kind: 'edit', id: entry.id });
    expect(later.result.current.savedDraft).toBe(false);
  });

  it('leaves out an activity that is gone since', async () => {
    const group = listGroups(mockDb!)[0]!;
    const activity = createActivity(mockDb!, { group_id: group.id, name: 'Lesen' });
    useDataVersion.getState().bump();
    const first = await open(newOn(day));
    await act(async () => first.result.current.update({ activity_ids: [activity.id, 99999], note: 'mit Lesen' }));
    await wait(DRAFT_SAVE_DELAY_MS);
    const second = await open(newOn(day));
    await act(async () => second.result.current.resumeSaved());
    expect(second.result.current.draft?.activity_ids).toEqual([activity.id]);
    expect(listActivities(mockDb!).some((row) => row.id === activity.id)).toBe(true);
  });
});
