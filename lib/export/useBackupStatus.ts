import { getDb } from '@/db';
import { firstEntryDate } from '@/db/repositories/entries';
import { useToday } from '@/lib/dates/useToday';
import { useQuery } from '@/lib/store/dataVersion';
import { useSettingsStore } from '@/lib/store/settingsStore';

import { backupStatus, type BackupStatus } from './backup';

/** Screen-facing view of the backup rule. Re-reads whenever data or settings change. */
export function useBackupStatus(): BackupStatus {
  const lastExportAt = useSettingsStore((s) => s.settings?.last_export_at ?? null);
  const first = useQuery(() => firstEntryDate(getDb()), []);
  return backupStatus({ lastExportAt, firstEntryDate: first, now: useToday() });
}
