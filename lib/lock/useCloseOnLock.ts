import { useEffect } from 'react';

import { useLockStore } from './store';

/**
 * Closes a sheet when the app locks. A React Native `Modal` is a window of its own and would stay
 * above the lock screen, which only covers the main window.
 */
export function useCloseOnLock(close: () => void): void {
  useEffect(
    () =>
      useLockStore.subscribe((state, previous) => {
        if (state.locked && !previous.locked) close();
      }),
    [close],
  );
}
