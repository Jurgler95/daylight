import { create } from 'zustand';

interface LockState {
  /** True while the app content must stay hidden. */
  locked: boolean;
  /** Timestamp of the moment the app went to the background, or null while in the foreground. */
  leftAt: number | null;
  /** True when that departure went to a system screen the app opened itself (see `withLockSuspended`). */
  leftForSystem: boolean;
  /** How many such system screens are open right now. */
  suspended: number;
  lock: () => void;
  unlock: () => void;
  setLeftAt: (value: number | null) => void;
}

export const useLockStore = create<LockState>((set) => ({
  locked: false,
  leftAt: null,
  leftForSystem: false,
  suspended: 0,
  lock: () => set({ locked: true }),
  unlock: () => set({ locked: false, leftAt: null, leftForSystem: false }),
  setLeftAt: (leftAt) => set({ leftAt }),
}));

/**
 * Time a system screen the app opened itself (photo picker, share sheet, a permission dialog) may
 * stay in front before coming back asks for the lock again. Longer than any delay setting would
 * make sense for, short enough that a phone put down in the photo picker still locks.
 */
export const SYSTEM_SCREEN_GRACE_SECONDS = 120;

/**
 * Whether coming back to the front locks the app again. Only a recorded departure counts: unlocking
 * clears `leftAt`, and the device PIN prompt is its own activity, so its "back to the front" arrives
 * after the unlock. Without this rule a delay of zero would lock straight away again.
 */
export function shouldRelock(leftAt: number | null, now: number, delaySeconds: number, leftForSystem = false): boolean {
  const seconds = leftForSystem ? Math.max(delaySeconds, SYSTEM_SCREEN_GRACE_SECONDS) : delaySeconds;
  return leftAt !== null && now - leftAt >= seconds * 1000;
}

/**
 * Follows the app going to the background and coming back. With a delay of zero the lock closes
 * on leaving already, so no frame of the diary shows on the way back and the recents switcher has
 * nothing to show either. Leaving for a system screen the app opened itself does not count as
 * leaving unless it lasts longer than `SYSTEM_SCREEN_GRACE_SECONDS`.
 */
export function handleAppStateChange(state: string, now: number, delaySeconds: number): void {
  const { leftAt, leftForSystem, suspended, locked } = useLockStore.getState();
  if (state === 'background' || state === 'inactive') {
    const forSystem = leftAt === null ? suspended > 0 : leftForSystem;
    if (leftAt === null) useLockStore.setState({ leftAt: now, leftForSystem: forSystem });
    if (state === 'background' && delaySeconds === 0 && !forSystem && !locked) useLockStore.setState({ locked: true });
    return;
  }
  if (state !== 'active') return;
  const relock = shouldRelock(leftAt, now, delaySeconds, leftForSystem);
  useLockStore.setState({ leftAt: null, leftForSystem: false, ...(relock ? { locked: true } : null) });
}

/**
 * Runs something that opens a system screen above the app (photo picker, share sheet, document
 * picker, a permission dialog), so returning from it does not ask for the lock again.
 */
export async function withLockSuspended<T>(run: () => Promise<T>): Promise<T> {
  useLockStore.setState((s) => ({ suspended: s.suspended + 1 }));
  try {
    return await run();
  } finally {
    useLockStore.setState((s) => ({ suspended: Math.max(0, s.suspended - 1) }));
  }
}

/** Called once at startup, before the first screen renders. */
export function initialiseLock(enabled: boolean): void {
  useLockStore.setState({ locked: enabled, leftAt: null, leftForSystem: false });
}
