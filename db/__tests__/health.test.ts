import { settingsForExport } from '@/lib/export';

import { countHealthDays, deleteAllData, firstHealthDate, getSettings, listHealthDays, replaceHealthDays, updateSettings } from '../repositories';
import { createTestDb } from '../testDb';

const row = (date: string, steps: number | null) => ({ date, steps, sleep_minutes: null, resting_hr: null, exercise_minutes: null });

describe('health days', () => {
  it('replaces a range and skips days without any value', () => {
    const db = createTestDb();
    replaceHealthDays(db, '2026-09-01', '2026-09-03', [row('2026-09-01', 100), row('2026-09-02', null), row('2026-09-03', 300)]);
    expect(listHealthDays(db).map((d) => [d.date, d.steps])).toEqual([
      ['2026-09-01', 100],
      ['2026-09-03', 300],
    ]);
    replaceHealthDays(db, '2026-09-02', '2026-09-03', [row('2026-09-02', 200)]);
    expect(listHealthDays(db).map((d) => [d.date, d.steps])).toEqual([
      ['2026-09-01', 100],
      ['2026-09-02', 200],
    ]);
    expect(firstHealthDate(db)).toBe('2026-09-01');
  });

  it('are gone after deleting all data, and the sync is off again', () => {
    const db = createTestDb();
    updateSettings(db, { health_enabled: true, health_synced_from: '2026-08-01' });
    replaceHealthDays(db, '2026-09-01', '2026-09-01', [row('2026-09-01', 100)]);
    deleteAllData(db);
    expect(countHealthDays(db)).toBe(0);
    expect(getSettings(db)).toMatchObject({ health_enabled: false, health_synced_from: null });
  });

  it('the sync state stays out of the backup', () => {
    const db = createTestDb();
    updateSettings(db, { health_enabled: true, health_last_sync_at: '2026-09-27T10:00:00.000Z', health_last_error: 'x' });
    expect(Object.keys(settingsForExport(getSettings(db))).filter((key) => key.startsWith('health'))).toEqual([]);
  });
});
