import { firstEntryDate } from '@/db/repositories/entries';
import { replaceHealthDays, type HealthDayInput } from '@/db/repositories/health';
import { getSettings, updateSettings } from '@/db/repositories/settings';
import type { Database } from '@/db/types';
import { toDateString, type DateString } from '@/lib/dates';

import { backfillPending, planSync, withinPause, type SyncPlanInput, type SyncWindow } from './days';

export interface HealthSource {
  granted: () => Promise<ReadonlySet<string>>;
  read: (from: DateString, to: DateString, types: ReadonlySet<string>) => Promise<HealthDayInput[]>;
}

export interface SyncOptions {
  db: Database;
  source: HealthSource;
  now: Date;
  /** Skips the pause, for "Jetzt abgleichen". */
  force?: boolean;
  /** Called before each window is read; the indicator shows the month of backfill windows. */
  onWindow?: (window: SyncWindow, index: number, total: number) => void;
  /** Runs each database write, so the app can tell its screens to re-read. */
  write?: <T>(run: () => T) => T;
  /** Checked between windows: switching off during a long backfill stops it after the current month. */
  stillEnabled?: () => boolean;
}

export type SyncOutcome = 'off' | 'paused' | 'nothing-allowed' | 'done' | 'stopped' | 'failed';

function planInput(db: Database, today: DateString): SyncPlanInput & { lastSyncAt: string | null; enabled: boolean } {
  const settings = getSettings(db);
  return {
    today,
    firstEntry: firstEntryDate(db),
    syncedFrom: settings.health_synced_from as DateString | null,
    lastSyncDay: settings.health_last_sync_at ? toDateString(new Date(settings.health_last_sync_at)) : null,
    lastSyncAt: settings.health_last_sync_at,
    enabled: settings.health_enabled,
  };
}

/**
 * One sync: reads the planned windows newest first and saves each one right away. A failure keeps
 * everything saved so far and is noted in the settings; the next return to the app tries again.
 */
export async function syncHealth({ db, source, now, force = false, onWindow, write = (run) => run(), stillEnabled = () => true }: SyncOptions): Promise<SyncOutcome> {
  const today = toDateString(now);
  const input = planInput(db, today);
  if (!input.enabled) return 'off';
  if (!force && withinPause(input.lastSyncAt, now) && !backfillPending(input)) return 'paused';

  try {
    const types = await source.granted();
    if (types.size === 0) {
      write(() => updateSettings(db, { health_last_error: 'Kein Zugriff erlaubt' }));
      return 'nothing-allowed';
    }
    const windows = planSync(input);
    for (const [index, window] of windows.entries()) {
      if (!stillEnabled()) return 'stopped';
      onWindow?.(window, index, windows.length);
      const days = await source.read(window.from, window.to, types);
      write(() => {
        replaceHealthDays(db, window.from, window.to, days);
        const syncedFrom = getSettings(db).health_synced_from;
        if (window.backfill && (!syncedFrom || window.from < syncedFrom)) updateSettings(db, { health_synced_from: window.from });
      });
    }
    write(() => updateSettings(db, { health_last_sync_at: now.toISOString(), health_last_error: null }));
    return 'done';
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    write(() => updateSettings(db, { health_last_error: message.slice(0, 300) }));
    return 'failed';
  }
}
