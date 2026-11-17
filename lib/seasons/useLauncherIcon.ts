import { useEffect } from 'react';

import { useLockStore } from '@/lib/lock/store';
import Launcher from '@/modules/daylight-launcher';

import { useDesign } from './useDesign';

/**
 * Keeps the icon on the home screen on today's design (`modules/daylight-launcher`), or on the logo
 * while the designs are off; also on the logo, so a switch cut short never leaves two icons. The
 * module switches only once no activity of the app is visible, and holds while a system screen the
 * app opened (photo picker, share sheet, permission dialog, the unlock prompt) is in front. Mounted
 * once in the root layout, inside `DesignProvider`.
 */
export function useLauncherIcon(): void {
  const target = useDesign() ?? 'logo';

  useEffect(() => {
    try {
      Launcher?.setTarget(target);
    } catch {
      // A build without the alias keeps its icon; the app must never trip over decoration.
    }
  }, [target]);

  // Straight from the store, not after a render: the picker opens in the same tick as the count goes up.
  useEffect(() => {
    const launcher = Launcher;
    if (!launcher) return;
    const isHeld = (s: ReturnType<typeof useLockStore.getState>) => s.suspended > 0 || s.authenticating;
    launcher.setHeld(isHeld(useLockStore.getState()));
    return useLockStore.subscribe((s) => launcher.setHeld(isHeld(s)));
  }, []);
}
