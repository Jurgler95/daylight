import { addDaysToDateString, isDateString, type DateString } from '@/lib/dates';

import type { StreakState } from './streak';

/** `small` the chip pulses, `large` a banner joins in, `huge` an overlay of its own. */
export type Milestone = 'small' | 'large' | 'huge';

/** Biggest first: where thresholds coincide (200 is also 50 and 10), the biggest wins. */
export const MILESTONES: readonly { milestone: Milestone; every: number }[] = [
  { milestone: 'huge', every: 200 },
  { milestone: 'large', every: 50 },
  { milestone: 'small', every: 10 },
];

/**
 * The biggest milestone among the thresholds a streak passes going from `previousDays` to
 * `nextDays`. A jump over several (filling in a gap) celebrates once: 45 to 103 is `large` for 50.
 */
export function milestoneFor(previousDays: number, nextDays: number): Milestone | null {
  for (const { milestone, every } of MILESTONES) {
    if (Math.floor(nextDays / every) > Math.floor(previousDays / every)) return milestone;
  }
  return null;
}

/** The highest length celebrated so far and the first day of its streak, kept on the device. */
export interface CelebratedStreak {
  start: DateString;
  days: number;
}

export function parseCelebrated(text: string | null | undefined): CelebratedStreak | null {
  if (!text) return null;
  try {
    const value: unknown = JSON.parse(text);
    if (!value || typeof value !== 'object') return null;
    const { start, days } = value as Record<string, unknown>;
    return typeof start === 'string' && isDateString(start) && typeof days === 'number' ? { start, days } : null;
  } catch {
    return null;
  }
}

/**
 * The length already celebrated for the streak running from `streakStart` over `days` days, 0 for
 * another streak. The stored start counts as the same streak while it lies inside the run: filling
 * in days before it moves the start, but it is still the streak that was celebrated.
 */
export function celebratedDays(stored: CelebratedStreak | null, streakStart: DateString, days: number): number {
  if (!stored || days <= 0) return 0;
  const end = addDaysToDateString(streakStart, days - 1);
  return stored.start >= streakStart && stored.start <= end ? stored.days : 0;
}

/**
 * Whether reaching `days` is worth a celebration: each threshold once per streak, so deleting an
 * entry and writing it again, or a second device-local check, does not celebrate twice.
 */
export function shouldCelebrate(stored: CelebratedStreak | null, streakStart: DateString, days: number, previousDays = 0): Milestone | null {
  return milestoneFor(Math.max(previousDays, celebratedDays(stored, streakStart, days)), days);
}

export interface StreakCelebration {
  milestone: Milestone | null;
  /** The save filled in yesterday or closed a gap. */
  rescued: boolean;
  /** Length of the streak after the save. */
  days: number;
}

/** How a celebration shows: the chip pulses, a banner slides in, or an overlay takes the screen. */
export type CelebrationStage = 'pulse' | 'banner' | 'overlay';

export function celebrationStage(celebration: StreakCelebration): CelebrationStage {
  if (celebration.milestone === 'huge') return 'overlay';
  if (celebration.milestone === 'large' || celebration.rescued) return 'banner';
  return 'pulse';
}

/** The length the streak had before the save: the run still going, or for a broken one the run the gap interrupted. */
function lengthBefore(state: StreakState): number {
  if (state.status === 'broken') return state.rescue?.runBeforeGap ?? 0;
  return state.status === 'none' ? 0 : state.days;
}

/**
 * What one save did to the streak, from the states before and after it, and the record to store
 * when a milestone is celebrated. Null when there is nothing to celebrate. Only ever called for a
 * save in the editor: imports and sample data never celebrate.
 */
export function celebrationFor(
  before: StreakState,
  after: StreakState,
  stored: CelebratedStreak | null,
): { celebration: StreakCelebration; record: CelebratedStreak | null } | null {
  if (after.status !== 'active' || !after.start) return null;
  // Yesterday filled in, or a whole gap closed (also behind a run still going).
  const rescued = before.restoredDays !== undefined && after.days >= before.restoredDays;
  const milestone = shouldCelebrate(stored, after.start, after.days, lengthBefore(before));
  if (!milestone && !rescued) return null;
  return {
    celebration: { milestone, rescued, days: after.days },
    record: milestone ? { start: after.start, days: after.days } : null,
  };
}
