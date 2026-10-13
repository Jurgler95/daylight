import { useEffect } from 'react';
import { create } from 'zustand';

import { celebrationStage, type StreakCelebration } from '@/lib/streak/celebration';

/**
 * Everything that lies over the screens for a moment, highest priority first:
 * `reminderPrompt` the start sheet that offers the reminder (hooked in with the reminder sheet),
 * `streak` a streak celebration (banner or overlay), `stars` the star message.
 */
export const OVERLAY_PRIORITY = ['reminderPrompt', 'streak', 'stars'] as const;
export type OverlayKind = (typeof OVERLAY_PRIORITY)[number];

/** Screens an overlay would cover in the middle of writing; every overlay waits until they close. */
export const OVERLAY_BUSY_PATHS = ['/entry', '/photo', '/turning/new'] as const;

export function overlayBlocked(pathname: string): boolean {
  return OVERLAY_BUSY_PATHS.some((prefix) => pathname.startsWith(prefix));
}

/** The overlay that may show while `waiting` all have something to show: one at a time, by priority. */
export function activeOverlay(waiting: Iterable<OverlayKind>): OverlayKind | null {
  const set = new Set(waiting);
  return OVERLAY_PRIORITY.find((kind) => set.has(kind)) ?? null;
}

export type ChipPulse = 'tick' | 'quiet';

interface OverlayState {
  /** Kinds with something to show right now, in no particular order. */
  waiting: readonly OverlayKind[];
  /** Banner or overlay from the last save that crossed a milestone or closed a gap, until it was seen. */
  celebration: StreakCelebration | null;
  /**
   * The streak chip on "Heute" pulses the next time it is in view: `tick` with a light buzz of its
   * own for a small milestone, `quiet` when a banner or overlay already buzzes.
   */
  chipPulse: ChipPulse | null;
  request: (kind: OverlayKind) => void;
  release: (kind: OverlayKind) => void;
  /** Every celebration pulses the chip; banner and overlay wait in `celebration` for their turn. */
  celebrate: (celebration: StreakCelebration) => void;
  clearCelebration: () => void;
  /** Hands out the pending pulse once. */
  takeChipPulse: () => ChipPulse | null;
}

/**
 * One slot for everything that lies over the screens, so the start sheet, a streak celebration and
 * the star message never show at the same time: the others wait their turn. The root layout mounts
 * them only while the app is unlocked, so none of them ever covers the lock screen.
 */
export const useOverlayStore = create<OverlayState>((set, get) => ({
  waiting: [],
  celebration: null,
  chipPulse: null,
  request: (kind) => set((s) => (s.waiting.includes(kind) ? s : { waiting: [...s.waiting, kind] })),
  release: (kind) => set((s) => (s.waiting.includes(kind) ? { waiting: s.waiting.filter((k) => k !== kind) } : s)),
  celebrate: (celebration) =>
    set((s) =>
      celebrationStage(celebration) === 'pulse' ? { chipPulse: 'tick' } : { celebration, chipPulse: s.chipPulse === 'tick' ? 'tick' : 'quiet' },
    ),
  clearCelebration: () => set({ celebration: null }),
  takeChipPulse: () => {
    const pulse = get().chipPulse;
    if (pulse) set({ chipPulse: null });
    return pulse;
  },
}));

/**
 * Asks for the slot while `wants` is true and gives it back otherwise. True while this kind is the
 * one to show. A higher kind that comes up takes over; the one it pushed aside shows again after.
 */
export function useOverlaySlot(kind: OverlayKind, wants: boolean): boolean {
  const request = useOverlayStore((s) => s.request);
  const release = useOverlayStore((s) => s.release);
  useEffect(() => {
    if (!wants) return;
    request(kind);
    return () => release(kind);
  }, [kind, wants, request, release]);
  return useOverlayStore((s) => wants && activeOverlay(s.waiting) === kind);
}
