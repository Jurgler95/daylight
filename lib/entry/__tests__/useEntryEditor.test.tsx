import { act, renderHook } from '@testing-library/react-native';

import type { Database } from '@/db';
import { createEntry, listEntries, listMoods } from '@/db/repositories';
import { createTestDb } from '@/db/testDb';
import type { DateString } from '@/lib/dates';
import { mutate, useDataVersion } from '@/lib/store/dataVersion';
import { useSettingsStore } from '@/lib/store/settingsStore';

import { useEntryEditor, type EditorTarget } from '../useEntryEditor';

/** Saving from the editor: once per editor, and never onto a day another editor took meanwhile. */
let mockDb: Database | null = null;
jest.mock('@/db/client', () => ({ getDb: () => mockDb, DATABASE_NAME: 'test.db' }));

const day = '2026-09-20' as DateString;

function open(target: EditorTarget) {
  return renderHook(() => useEntryEditor(target));
}

describe('entry editor', () => {
  let mood: number;
  beforeEach(() => {
    mockDb = createTestDb();
    useDataVersion.getState().bump();
    useSettingsStore.getState().load();
    mood = listMoods(mockDb)[2]!.id;
  });

  it('writes a new entry only once, however often "Speichern" is tapped', async () => {
    const { result } = await open({ kind: 'new', date: day, moodId: mood });
    let first = false;
    let second = true;
    await act(async () => {
      first = result.current.save();
    });
    await act(async () => {
      second = result.current.save();
    });
    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(listEntries(mockDb!).filter((entry) => entry.date === day)).toHaveLength(1);
    // Its own entry does not count as taking the day while it closes.
    expect(result.current.dayTaken).toBe(false);
  });

  it('refuses a day that was taken after the editor opened', async () => {
    const { result } = await open({ kind: 'new', date: day, moodId: mood });
    expect(result.current.canSave).toBe(true);
    await act(async () => {
      mutate(() => createEntry(mockDb!, { date: day, time: '08:00', mood_id: mood }));
    });
    expect(result.current.dayTaken).toBe(true);
    expect(result.current.canSave).toBe(false);
    let saved = true;
    await act(async () => {
      saved = result.current.save();
    });
    expect(saved).toBe(false);
    expect(listEntries(mockDb!).filter((entry) => entry.date === day)).toHaveLength(1);
  });
});
