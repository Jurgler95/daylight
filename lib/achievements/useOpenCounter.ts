import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useSettingsStore } from '@/lib/store/settingsStore';

import { countsAsOpen } from './opens';

function countOpen() {
  const { settings, update } = useSettingsStore.getState();
  update({ app_opens: (settings?.app_opens ?? 0) + 1 });
}

/** Counts every opening of the app for the "Stammgast" achievement: the start, then every return after a while away. */
export function useOpenCounter(): void {
  useEffect(() => {
    countOpen();
    let leftAt: number | null = null;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background') leftAt = Date.now();
      else if (state === 'active' && leftAt !== null) {
        if (countsAsOpen(Date.now() - leftAt)) countOpen();
        leftAt = null;
      }
    });
    return () => subscription.remove();
  }, []);
}
