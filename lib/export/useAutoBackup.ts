import Constants from 'expo-constants';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { getDb } from '@/db';
import { filePhotoStore } from '@/lib/photos/fileStore';
import { useDataVersion } from '@/lib/store/dataVersion';
import { useSettingsStore } from '@/lib/store/settingsStore';

import { autoBackupDelay, runAutoBackup, type AutoBackupResult } from './auto';
import { storageFolder } from './autoFolder';

/** After the start the first screen comes first; the backup follows a moment later. */
export const START_DELAY_MS = 5000;

let running = false;
/**
 * The data version the last run found saved ('written' or 'unchanged'), in memory only. Without a
 * write since, a run would build the whole export just to find the same fingerprint again.
 */
let checkedVersion: number | null = null;

/**
 * Runs one automatic backup with the folder from the settings and refreshes the settings, so
 * "Automatische Sicherung" shows the result. Never throws.
 */
export function autoBackupNow(force = false): AutoBackupResult {
  const dir = useSettingsStore.getState().settings?.auto_backup_dir;
  if (!dir || running) return 'off';
  const version = useDataVersion.getState().version;
  if (!force && checkedVersion === version) return 'unchanged';
  running = true;
  try {
    const result = runAutoBackup({
      db: getDb(),
      folder: storageFolder(dir),
      store: filePhotoStore,
      appVersion: Constants.expoConfig?.version ?? '0.0.0',
      force,
    });
    checkedVersion = result === 'written' || result === 'unchanged' ? version : null;
    if (result === 'written' || result === 'failed') useSettingsStore.getState().load();
    return result;
  } catch {
    checkedVersion = null;
    return 'failed';
  } finally {
    running = false;
  }
}

/**
 * Mounted once in the root layout: a run shortly after the start and after each change to the
 * data, a few seconds later for the day's first backup and a minute later when it replaces the
 * day's file (`autoBackupDelay`). A run still waiting goes at once when the app goes to the
 * background, so the last entry of the evening is not left for the next start.
 */
export function useAutoBackup(): void {
  const dir = useSettingsStore((s) => s.settings?.auto_backup_dir ?? null);

  useEffect(() => {
    if (!dir) return;
    const run = () => {
      timer = null;
      autoBackupNow();
    };
    let timer: ReturnType<typeof setTimeout> | null = setTimeout(run, START_DELAY_MS);
    const unsubscribe = useDataVersion.subscribe((state, previous) => {
      if (state.version === previous.version) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(run, autoBackupDelay(useSettingsStore.getState().settings?.auto_backup_at ?? null, new Date()));
    });
    const appState = AppState.addEventListener('change', (next) => {
      if (next !== 'background' || !timer) return;
      clearTimeout(timer);
      run();
    });
    return () => {
      unsubscribe();
      appState.remove();
      if (timer) clearTimeout(timer);
      timer = null;
    };
  }, [dir]);
}
