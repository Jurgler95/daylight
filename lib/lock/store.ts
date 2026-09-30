import { create } from 'zustand';

interface LockState {
  /** True while the app content must stay hidden. */
  locked: boolean;
  /** Timestamp of the moment the app went to the background, or null while in the foreground. */
  leftAt: number | null;
  lock: () => void;
  unlock: () => void;
  setLeftAt: (value: number | null) => void;
}

export const useLockStore = create<LockState>((set) => ({
  locked: false,
  leftAt: null,
  lock: () => set({ locked: true }),
  unlock: () => set({ locked: false, leftAt: null }),
  setLeftAt: (leftAt) => set({ leftAt }),
}));

/**
 * Whether coming back to the front locks the app again. Only a recorded departure counts: unlocking
 * clears `leftAt`, and the device PIN prompt is its own activity, so its "back to the front" arrives
 * after the unlock. Without this rule a delay of zero would lock straight away again.
 */
export function shouldRelock(leftAt: number | null, now: number, delaySeconds: number): boolean {
  return leftAt !== null && now - leftAt >= delaySeconds * 1000;
}

/** Called once at startup, before the first screen renders. */
export function initialiseLock(enabled: boolean): void {
  useLockStore.setState({ locked: enabled, leftAt: null });
}
