import { allowScreenCaptureAsync, preventScreenCaptureAsync } from 'expo-screen-capture';

import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useSettingsStore } from '@/lib/store/settingsStore';

import { handleAppStateChange, useLockStore } from './store';

const SCREEN_CAPTURE_KEY = 'app-lock';

/** FLAG_SECURE is a nice-to-have: if the platform refuses, the lock itself still works. */
function setScreenCapture(prevent: boolean): void {
  const call = prevent ? preventScreenCaptureAsync : allowScreenCaptureAsync;
  call(SCREEN_CAPTURE_KEY).catch(() => undefined);
}

/**
 * Locks the app again after it was in the background for longer than the configured delay and
 * hides the preview in the recents switcher (FLAG_SECURE) while the lock is enabled.
 * Mounted once in the root layout.
 */
export function useAppLock(): { locked: boolean } {
  const enabled = useSettingsStore((s) => s.settings?.app_lock_enabled ?? false);
  const delaySeconds = useSettingsStore((s) => s.settings?.app_lock_delay_seconds ?? 0);
  const locked = useLockStore((s) => s.locked);

  useEffect(() => {
    if (!enabled) {
      useLockStore.setState({ locked: false, leftAt: null, leftForSystem: false });
      setScreenCapture(false);
      return;
    }
    setScreenCapture(true);
    return () => setScreenCapture(false);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const subscription = AppState.addEventListener('change', (state) => handleAppStateChange(state, Date.now(), delaySeconds));
    return () => subscription.remove();
  }, [enabled, delaySeconds]);

  return { locked: enabled && locked };
}
