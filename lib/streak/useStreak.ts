import { useIsFocused, usePathname } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import type { DateString } from '@/lib/dates';
import { haptics } from '@/lib/haptics';
import { useQuery } from '@/lib/store/dataVersion';
import { overlayBlocked, useOverlaySlot, useOverlayStore } from '@/lib/store/overlays';
import { useSettingsStore } from '@/lib/store/settingsStore';

import { readStreak } from './celebrate';
import type { StreakCelebration } from './celebration';
import type { StreakState } from './streak';
import { showRescueCard, streakChip, type StreakChipView } from './view';

export interface StreakView {
  state: StreakState;
  /** Null while the chip stays hidden. */
  chip: StreakChipView | null;
  /** The rescue card for a broken streak is up. */
  rescue: boolean;
  dismissRescue: () => void;
}

/** The streak on "Heute": its state, the chip and whether the rescue card shows. */
export function useStreak(today: DateString): StreakView {
  const dismissedOn = useSettingsStore((s) => s.settings?.streak_rescue_dismissed ?? null) as DateString | null;
  const update = useSettingsStore((s) => s.update);
  const state = useQuery(() => readStreak(today), [today]);
  const rescue = showRescueCard(state, dismissedOn);
  const dismissRescue = useCallback(() => update({ streak_rescue_dismissed: today }), [update, today]);
  return { state, chip: streakChip(state, rescue), rescue, dismissRescue };
}

/**
 * Counts up each time the streak chip should pulse: once after a save that celebrated, as soon as
 * the screen with the chip is focused and the chip is there. Tabs freeze while out of sight, so
 * the pulse waits for the next visit instead of playing unseen.
 */
export function useChipPulse(chipShown: boolean): number {
  const focused = useIsFocused();
  const pending = useOverlayStore((s) => s.chipPulse);
  const [pulses, setPulses] = useState(0);
  useEffect(() => {
    if (!focused || !chipShown || !pending) return;
    const pulse = useOverlayStore.getState().takeChipPulse();
    if (!pulse) return;
    if (pulse === 'tick') haptics.tick();
    setPulses((n) => n + 1);
  }, [focused, chipShown, pending]);
  return pulses;
}

/**
 * The banner or overlay of the last celebrating save, when it is its turn: not over an open entry
 * and not while the start sheet is up. A star message waits until this one is put away.
 */
export function useStreakCelebration(): { celebration: StreakCelebration | null; dismiss: () => void } {
  const pending = useOverlayStore((s) => s.celebration);
  const dismiss = useOverlayStore((s) => s.clearCelebration);
  const pathname = usePathname();
  const mine = useOverlaySlot('streak', pending !== null && !overlayBlocked(pathname));
  return { celebration: mine ? pending : null, dismiss };
}
