import { createTestDb } from '@/db/testDb';
import { createEntry } from '@/db/repositories/entries';
import { updateSettings } from '@/db/repositories/settings';
import type { DateString } from '@/lib/dates';

import { backupStatus, BACKUP_REMINDER_DAYS } from '../backup';
import { buildExport } from '../serialize';

const day = (value: string) => value as DateString;

describe('backupStatus', () => {
  it('stays quiet while there is nothing to lose', () => {
    expect(backupStatus({ lastExportAt: null, firstEntryDate: null, now: day('2026-09-15') })).toEqual({
      days: null,
      everExported: false,
      due: false,
    });
  });

  it('counts from the first entry when there never was a backup', () => {
    const status = backupStatus({ lastExportAt: null, firstEntryDate: day('2026-07-01'), now: day('2026-09-15') });
    expect(status.everExported).toBe(false);
    expect(status.days).toBe(76);
    expect(status.due).toBe(true);
  });

  it('counts from the last backup once there is one', () => {
    const status = backupStatus({ lastExportAt: '2026-09-10T08:00:00.000Z', firstEntryDate: day('2026-01-01'), now: day('2026-09-15') });
    expect(status).toEqual({ days: 5, everExported: true, due: false });
  });

  it('turns due exactly at the threshold', () => {
    const on = (now: string) => backupStatus({ lastExportAt: null, firstEntryDate: day('2026-01-01'), now: day(now) });
    expect(on('2026-03-01')).toMatchObject({ days: BACKUP_REMINDER_DAYS - 1, due: false });
    expect(on('2026-03-02')).toMatchObject({ days: BACKUP_REMINDER_DAYS, due: true });
  });

  it('ignores an unusable timestamp instead of crashing', () => {
    const status = backupStatus({ lastExportAt: 'not a date', firstEntryDate: day('2026-09-14'), now: day('2026-09-15') });
    expect(status).toEqual({ days: 1, everExported: false, due: false });
  });
});

describe('export payload', () => {
  it('leaves the backup timestamp out, because it describes the device and not the data', () => {
    const db = createTestDb();
    createEntry(db, { date: '2026-09-01', time: '20:30', mood_id: 2 });
    updateSettings(db, { last_export_at: '2026-09-15T10:00:00.000Z' });
    expect('last_export_at' in buildExport(db, '1.0.0').settings).toBe(false);
  });
});
