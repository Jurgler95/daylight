import { useEffect, useState } from 'react';

import { getDb, runMigrations } from '@/db';
import { initialiseLock } from '@/lib/lock';
import { filePhotoStore } from '@/lib/photos/fileStore';
import { sweepPhotos } from '@/lib/photos/store';
import { useSettingsStore } from '@/lib/store/settingsStore';

import '@/lib/i18n';

type Status = { state: 'loading' } | { state: 'ready' } | { state: 'error'; error: Error };

/** Runs migrations and loads settings exactly once before the first screen renders. */
export function useAppBootstrap(): Status & { retry: () => void } {
  const [status, setStatus] = useState<Status>({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const load = useSettingsStore((s) => s.load);

  useEffect(() => {
    let cancelled = false;
    setStatus({ state: 'loading' });
    (async () => {
      try {
        await runMigrations();
        load();
        // Photos picked in an editor that was then left without saving; nothing else is open yet.
        try {
          sweepPhotos(getDb(), filePhotoStore);
        } catch {
          // Tidying up must never keep the app from starting.
        }
        // Locked from the very first frame, so no content flashes up before the lock screen.
        initialiseLock(useSettingsStore.getState().settings?.app_lock_enabled ?? false);
        if (!cancelled) setStatus({ state: 'ready' });
      } catch (e) {
        if (!cancelled) setStatus({ state: 'error', error: e instanceof Error ? e : new Error(String(e)) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt, load]);

  return { ...status, retry: () => setAttempt((n) => n + 1) };
}
