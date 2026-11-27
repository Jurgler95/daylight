import { createTestDb } from '@/db/testDb';
import { createEntry } from '@/db/repositories/entries';
import { updateSettings } from '@/db/repositories/settings';
import type { DateString } from '@/lib/dates';

import { AUTO_BACKUP_FAILING_DAYS, BACKUP_HINT_SNOOZE_DAYS, backupHint, backupStatus, BACKUP_REMINDER_DAYS } from '../backup';
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
    expect(on('2026-01-30')).toMatchObject({ days: BACKUP_REMINDER_DAYS - 1, due: false });
    expect(on('2026-01-31')).toMatchObject({ days: BACKUP_REMINDER_DAYS, due: true });
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

describe('backupStatus with an automatic backup', () => {
  it('counts from whichever backup is newer', () => {
    const status = backupStatus({
      lastExportAt: '2026-08-01T08:00:00.000Z',
      autoBackupAt: '2026-09-14T08:00:00.000Z',
      firstEntryDate: day('2026-01-01'),
      now: day('2026-09-15'),
    });
    expect(status).toEqual({ days: 1, everExported: true, due: false });
  });

  it('counts an automatic backup alone as a backup', () => {
    const status = backupStatus({ lastExportAt: null, autoBackupAt: '2026-09-10T08:00:00.000Z', firstEntryDate: day('2026-01-01'), now: day('2026-09-15') });
    expect(status).toEqual({ days: 5, everExported: true, due: false });
  });
});

describe('backupHint', () => {
  const now = day('2026-09-15');
  const due = backupStatus({ lastExportAt: null, firstEntryDate: day('2026-07-01'), now });
  const recent = backupStatus({ lastExportAt: '2026-09-14T08:00:00.000Z', firstEntryDate: day('2026-01-01'), now });

  it('reminds without automatic backup once the backup is a month old', () => {
    expect(backupHint({ status: due, autoBackupOn: false, autoBackupError: null, dismissedOn: null, now })).toBe('due');
    expect(backupHint({ status: recent, autoBackupOn: false, autoBackupError: null, dismissedOn: null, now })).toBe('none');
  });

  it('stays away for a month once put away, then comes back', () => {
    expect(BACKUP_HINT_SNOOZE_DAYS).toBe(30);
    const at = (dismissedOn: string) => backupHint({ status: due, autoBackupOn: false, autoBackupError: null, dismissedOn, now });
    expect(at('2026-08-20')).toBe('none');
    expect(at('2026-08-17')).toBe('none');
    expect(at('2026-08-16')).toBe('due');
  });

  it('is quiet while the automatic backup works, however old the manual one is', () => {
    expect(backupHint({ status: due, autoBackupOn: true, autoBackupError: null, dismissedOn: null, now })).toBe('none');
  });

  it('speaks up when the automatic backup keeps failing for a few days', () => {
    const old = backupStatus({ lastExportAt: null, autoBackupAt: '2026-09-11T08:00:00.000Z', firstEntryDate: day('2026-01-01'), now });
    expect(old.days).toBeGreaterThanOrEqual(AUTO_BACKUP_FAILING_DAYS);
    expect(backupHint({ status: old, autoBackupOn: true, autoBackupError: 'folder-missing', dismissedOn: null, now })).toBe('failing');
    expect(backupHint({ status: recent, autoBackupOn: true, autoBackupError: 'folder-missing', dismissedOn: null, now })).toBe('none');
    // Put away, a failure comes back after a week, not a month.
    expect(backupHint({ status: old, autoBackupOn: true, autoBackupError: 'x', dismissedOn: '2026-09-10', now })).toBe('none');
    expect(backupHint({ status: old, autoBackupOn: true, autoBackupError: 'x', dismissedOn: '2026-09-08', now })).toBe('failing');
  });
});
