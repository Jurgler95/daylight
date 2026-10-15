import { addDaysToDateString, type DateString } from '@/lib/dates';

import type { StreakState } from './streak';

/**
 * `outline` a streak that today has not joined yet, `filled` one that has, `amber` yesterday is
 * missing, `muted` a broken streak while its rescue card is up.
 */
export type StreakChipTone = 'outline' | 'filled' | 'amber' | 'muted';

export interface StreakChipView {
  tone: StreakChipTone;
  days: number;
}

/**
 * The rescue card while a gap can still be filled in (a broken streak, or a gap right before the
 * run still going), unless it was put away. "Later" holds for that gap only, also while it grows
 * because no entry follows. The anchor cannot tell a new gap apart: it is the oldest entry within
 * reach and can stay before the day the card was put away. A new gap is a missing day after an
 * entry made on or after that day.
 */
export function showRescueCard(state: StreakState, dismissedOn: DateString | null): boolean {
  if (!state.rescue) return false;
  if (!dismissedOn) return true;
  const { anchor, missing } = state.rescue;
  const lastMissing = missing.at(-1);
  if (!lastMissing) return false;
  const gap = new Set(missing);
  // Between the anchor and the last missing day, every day not missing has an entry.
  for (let day = anchor > dismissedOn ? anchor : dismissedOn; day < lastMissing; day = addDaysToDateString(day, 1)) if (!gap.has(day)) return true;
  return false;
}

/**
 * The chip next to the title on "Heute", null when it stays hidden. While yesterday is missing it
 * shows what filling it in saves, not the plain run, and so differs from the achievement `days`
 * on purpose. A broken streak shows a muted 0 (or 1 with an entry today) next to its rescue card;
 * once the card is put away, it is just a run of one day, or nothing.
 */
export function streakChip(state: StreakState, rescueShown: boolean): StreakChipView | null {
  switch (state.status) {
    case 'atRisk':
      return { tone: 'amber', days: state.days };
    case 'broken':
      if (rescueShown) return { tone: 'muted', days: state.days };
      return state.todayDone ? { tone: 'filled', days: state.days } : null;
    case 'active':
      return { tone: state.todayDone ? 'filled' : 'outline', days: state.days };
    case 'none':
      return null;
  }
}
