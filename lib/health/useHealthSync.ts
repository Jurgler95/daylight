import { useEffect } from 'react';
import { AppState } from 'react-native';

import { getDb } from '@/db';
import { useLockStore } from '@/lib/lock';
import { useDataVersion } from '@/lib/store/dataVersion';
import { useSettingsStore } from '@/lib/store/settingsStore';

import { grantedTypes, readHealthDays } from './client';
import { useHealthSyncStore } from './store';
import { syncHealth, type SyncOutcome } from './sync';

/**
 * Starts a sync unless one is running. Every window saved re-reads the screens and the settings,
 * so the insights fill up month by month during a long backfill.
 */
export async function runHealthSync(force = false): Promise<SyncOutcome | 'busy'> {
  if (useHealthSyncStore.getState().running) return 'busy';
  useHealthSyncStore.setState({ running: true, month: null });
  try {
    return await syncHealth({
      db: getDb(),
      source: { granted: grantedTypes, read: (from, to, types) => readHealthDays(from, to, types as Parameters<typeof readHealthDays>[2]) },
      now: new Date(),
      force,
      onWindow: (window, _index, total) => useHealthSyncStore.setState({ month: window.backfill && total > 1 ? window.from : null }),
      write: (run) => {
        const result = run();
        useDataVersion.getState().bump();
        useSettingsStore.getState().load();
        return result;
      },
      stillEnabled: () => useSettingsStore.getState().settings?.health_enabled ?? false,
    });
  } finally {
    useHealthSyncStore.setState({ running: false, month: null });
  }
}

/**
 * Syncs when the app opens and whenever it comes back to the front, once the lock is open.
 * Mounted once in the root layout. Never asks for permission by itself.
 */
export function useHealthSync(): void {
  const enabled = useSettingsStore((s) => s.settings?.health_enabled ?? false);
  const locked = useLockStore((s) => s.locked);

  useEffect(() => {
    if (!enabled || locked) return;
    const start = () => {
      runHealthSync().catch((error: unknown) => console.warn('Gesundheitsdaten konnten nicht abgeglichen werden', error));
    };
    start();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') start();
    });
    return () => subscription.remove();
  }, [enabled, locked]);
}
