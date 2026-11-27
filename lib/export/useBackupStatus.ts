import { getDb } from '@/db';
import { firstEntryDate } from '@/db/repositories/entries';
import { useToday } from '@/lib/dates/useToday';
import { useQuery } from '@/lib/store/dataVersion';
import { useSettingsStore } from '@/lib/store/settingsStore';

import { backupHint, backupStatus, type BackupHint, type BackupStatus } from './backup';

/** Screen-facing view of the backup rule. Re-reads whenever data or settings change. */
export function useBackupStatus(): BackupStatus {
  const lastExportAt = useSettingsStore((s) => s.settings?.last_export_at ?? null);
  const autoBackupAt = useSettingsStore((s) => s.settings?.auto_backup_at ?? null);
  const first = useQuery(() => firstEntryDate(getDb()), []);
  return backupStatus({ lastExportAt, autoBackupAt, firstEntryDate: first, now: useToday() });
}

/** Which card "Heute" shows about backups, and a way to put it away. */
export function useBackupHint(): { hint: BackupHint; status: BackupStatus; dismiss: () => void } {
  const status = useBackupStatus();
  const now = useToday();
  const autoBackupOn = useSettingsStore((s) => Boolean(s.settings?.auto_backup_dir));
  const autoBackupError = useSettingsStore((s) => s.settings?.auto_backup_error ?? null);
  const dismissedOn = useSettingsStore((s) => s.settings?.backup_hint_dismissed_on ?? null);
  const update = useSettingsStore((s) => s.update);
  const hint = backupHint({ status, autoBackupOn, autoBackupError, dismissedOn, now });
  return { hint, status, dismiss: () => update({ backup_hint_dismissed_on: now }) };
}
