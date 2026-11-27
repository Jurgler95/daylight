import Constants from 'expo-constants';
import { useEffect } from 'react';

import { getDb } from '@/db';
import { filePhotoStore } from '@/lib/photos/fileStore';
import { useDataVersion } from '@/lib/store/dataVersion';
import { useSettingsStore } from '@/lib/store/settingsStore';

import { runAutoBackup, type AutoBackupResult } from './auto';
import { storageFolder } from './autoFolder';

/** After the start the first screen comes first; the backup follows a moment later. */
const START_DELAY_MS = 5000;
/** Several saves in a row (an entry, then its photo) make one run. */
const CHANGE_DELAY_MS = 3000;

let running = false;

/**
 * Runs one automatic backup with the folder from the settings and refreshes the settings, so
 * "Automatische Sicherung" shows the result. Never throws.
 */
export function autoBackupNow(force = false): AutoBackupResult {
  const dir = useSettingsStore.getState().settings?.auto_backup_dir;
  if (!dir || running) return 'off';
  running = true;
  try {
    const result = runAutoBackup({
      db: getDb(),
      folder: storageFolder(dir),
      store: filePhotoStore,
      appVersion: Constants.expoConfig?.version ?? '0.0.0',
      force,
    });
    if (result === 'written' || result === 'failed') useSettingsStore.getState().load();
    return result;
  } catch {
    return 'failed';
  } finally {
    running = false;
  }
}

/**
 * Mounted once in the root layout: a run shortly after the start and a few seconds after each
 * change to the data. `runAutoBackup` itself keeps it to once a day and skips unchanged data.
 */
export function useAutoBackup(): void {
  const dir = useSettingsStore((s) => s.settings?.auto_backup_dir ?? null);

  useEffect(() => {
    if (!dir) return;
    let timer: ReturnType<typeof setTimeout> | null = setTimeout(() => autoBackupNow(), START_DELAY_MS);
    const unsubscribe = useDataVersion.subscribe((state, previous) => {
      if (state.version === previous.version) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => autoBackupNow(), CHANGE_DELAY_MS);
    });
    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
      timer = null;
    };
  }, [dir]);
}
