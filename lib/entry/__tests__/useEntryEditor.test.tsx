import { act, renderHook } from '@testing-library/react-native';

import type { Database } from '@/db';
import { createEntry, createExperiment, deleteExperiment, listEntries, listExperimentDays, listMoods } from '@/db/repositories';
import { createTestDb } from '@/db/testDb';
import type { DateString } from '@/lib/dates';
import { mutate, useDataVersion } from '@/lib/store/dataVersion';
import { useSettingsStore } from '@/lib/store/settingsStore';

import { useEntryEditor, type EditorTarget } from '../useEntryEditor';

/** Saving from the editor: once per editor, and onto any day, however many entries it already has. */
let mockDb: Database | null = null;
jest.mock('@/db/client', () => ({ getDb: () => mockDb, DATABASE_NAME: 'test.db' }));
jest.mock('@/lib/dates/useToday', () => ({ useToday: () => '2026-09-26' }));

const day = '2026-09-20' as DateString;
const other = '2026-09-18' as DateString;

function open(target: EditorTarget) {
  return renderHook(() => useEntryEditor(target));
}

const on = (date: string) => listEntries(mockDb!).filter((entry) => entry.date === date);

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
    expect(on(day)).toHaveLength(1);
  });

  it('adds a new entry to a day that already has one, and leaves that one alone', async () => {
    const existing = createEntry(mockDb!, { date: day, time: '08:00', mood_id: mood, note: 'früh', activity_ids: [] });
    const { result } = await open({ kind: 'new', date: day, moodId: mood });
    expect(result.current.canSave).toBe(true);
    // A fresh draft: nothing of the day's other entry is taken over.
    expect(result.current.draft).toMatchObject({ date: day, note: '', activity_ids: [], scales: {}, photos: [] });
    let saved = false;
    await act(async () => {
      saved = result.current.save();
    });
    expect(saved).toBe(true);
    expect(on(day)).toHaveLength(2);
    expect(on(day).find((entry) => entry.id === existing.id)).toMatchObject({ time: '08:00', note: 'früh' });
  });

  it('still saves when another entry of the day was written while the editor was open', async () => {
    const { result } = await open({ kind: 'new', date: day, moodId: mood });
    await act(async () => {
      mutate(() => createEntry(mockDb!, { date: day, time: '08:00', mood_id: mood }));
    });
    expect(result.current.canSave).toBe(true);
    let saved = false;
    await act(async () => {
      saved = result.current.save();
    });
    expect(saved).toBe(true);
    expect(on(day)).toHaveLength(2);
  });

  it('starts without a mood when none was picked, and cannot be saved until one is', async () => {
    createEntry(mockDb!, { date: day, time: '08:00', mood_id: mood });
    const { result } = await open({ kind: 'new', date: day, moodId: null });
    expect(result.current.draft?.mood_id).toBeNull();
    expect(result.current.canSave).toBe(false);
    await act(async () => result.current.update({ mood_id: mood }));
    expect(result.current.canSave).toBe(true);
  });

  it('moves an entry to a day that already has one', async () => {
    createEntry(mockDb!, { date: day, time: '08:00', mood_id: mood });
    const moving = createEntry(mockDb!, { date: other, time: '19:00', mood_id: mood, note: 'zieht um' });
    const { result } = await open({ kind: 'edit', id: moving.id });
    await act(async () => result.current.update({ date: day }));
    expect(result.current.canSave).toBe(true);
    let saved = false;
    await act(async () => {
      saved = result.current.save();
    });
    expect(saved).toBe(true);
    expect(on(day).map((entry) => entry.time)).toEqual(['08:00', '19:00']);
    expect(on(other)).toHaveLength(0);
  });

  it('gives a new entry on an earlier day the latest reminder time, and lets it be changed', async () => {
    await act(async () => useSettingsStore.getState().update({ reminder_times: ['09:00', '21:45', '14:00'] }));
    const { result } = await open({ kind: 'new', date: day, moodId: mood });
    expect(result.current.draft?.time).toBe('21:45');
    await act(async () => result.current.update({ time: '06:10' }));
    await act(async () => {
      result.current.save();
    });
    expect(on(day).map((entry) => entry.time)).toEqual(['06:10']);
  });

  it('drops changed answers when the day changes, and asks again for the new day', async () => {
    const running = createExperiment(mockDb!, { title: 'Kein Kaffee', start_date: '2026-09-15', days: 28, check_in: true }, '2026-09-26' as DateString);
    await act(async () => useDataVersion.getState().bump());
    const { result } = await open({ kind: 'new', date: day, moodId: mood });
    expect(result.current.checkIns.map((row) => row.experiment.id)).toEqual([running.id]);
    await act(async () => result.current.tapCheckIn(running.id, true));
    expect(result.current.dirty).toBe(true);
    expect(result.current.checkIns[0]!.answer).toBe(true);
    await act(async () => result.current.update({ date: '2026-09-19' as DateString }));
    expect(result.current.draft?.check_ins).toEqual({});
    expect(result.current.checkIns[0]!.answer).toBeNull();
    // Before the start nothing is asked, and nothing is written.
    await act(async () => result.current.update({ date: '2026-09-10' as DateString }));
    expect(result.current.checkIns).toEqual([]);
    await act(async () => {
      result.current.save();
    });
    expect(listExperimentDays(mockDb!)).toEqual([]);
  });

  it('saves the entry and the answers together: when the answers fail, the entry stays unsaved', async () => {
    const running = createExperiment(mockDb!, { title: 'Kein Kaffee', start_date: '2026-09-15', days: 28, check_in: true }, '2026-09-26' as DateString);
    await act(async () => useDataVersion.getState().bump());
    const { result } = await open({ kind: 'new', date: day, moodId: mood });
    await act(async () => result.current.tapCheckIn(running.id, true));
    // Gone behind the editor's back, so writing its answer fails.
    deleteExperiment(mockDb!, running.id);
    expect(() => result.current.save()).toThrow('not found');
    expect(on(day)).toEqual([]);
  });
});
