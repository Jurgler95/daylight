import type { Database } from '@/db';
import { createEntry, deleteEntry, getSettings, listMoods } from '@/db/repositories';
import { createTestDb } from '@/db/testDb';
import { addDaysToDateString, today } from '@/lib/dates';
import { mutate, useDataVersion } from '@/lib/store/dataVersion';
import { useOverlayStore } from '@/lib/store/overlays';
import { useSettingsStore } from '@/lib/store/settingsStore';

import { celebrateSave } from '../celebrate';

/** The save in the editor against a real database: what reaches the overlay store and the settings. */
let mockDb: Database | null = null;
jest.mock('@/db/client', () => ({ getDb: () => mockDb, DATABASE_NAME: 'test.db' }));

const day = (offset: number) => addDaysToDateString(today(), offset);

function setup(offsets: number[]) {
  const db = createTestDb();
  const mood = listMoods(db)[0]!.id;
  for (const offset of offsets) createEntry(db, { date: day(offset), time: '20:30', mood_id: mood });
  mockDb = db;
  useDataVersion.getState().bump();
  useSettingsStore.getState().load();
  useOverlayStore.setState({ waiting: [], celebration: null, chipPulse: null });
  const write = (offset: number) => mutate(() => createEntry(db, { date: day(offset), time: '20:30', mood_id: mood }));
  return { db, write };
}

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

describe('celebrateSave', () => {
  it('pulses the chip for the tenth day and stores the record, once', () => {
    const { db, write } = setup(range(-9, -1));
    let entry = 0;
    expect(celebrateSave(() => (entry = write(0).id))).toEqual({ milestone: 'small', rescued: false, days: 10 });
    expect(useOverlayStore.getState()).toMatchObject({ chipPulse: 'tick', celebration: null });
    expect(JSON.parse(getSettings(db).streak_celebrated!)).toEqual({ start: day(-9), days: 10 });

    // Deleted and written again: no second celebration.
    mutate(() => deleteEntry(db, entry));
    useOverlayStore.setState({ chipPulse: null });
    expect(celebrateSave(() => write(0))).toBeNull();
    expect(useOverlayStore.getState().chipPulse).toBeNull();
  });

  it('puts a banner up when a gap is closed', () => {
    const { write } = setup(range(-6, -2));
    expect(celebrateSave(() => write(-1))).toEqual({ milestone: null, rescued: true, days: 6 });
    expect(useOverlayStore.getState()).toMatchObject({ celebration: { rescued: true, days: 6 }, chipPulse: 'quiet' });
  });

  it('stays quiet for an ordinary day', () => {
    const { write } = setup(range(-4, -1));
    expect(celebrateSave(() => write(0))).toBeNull();
    expect(useOverlayStore.getState()).toMatchObject({ celebration: null, chipPulse: null });
  });
});
