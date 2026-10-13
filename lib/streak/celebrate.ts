import { today as currentDay, type DateString } from '@/lib/dates';
import { readInsightEntries } from '@/lib/insights/useInsights';
import { cached } from '@/lib/store/dataVersion';
import { useOverlayStore } from '@/lib/store/overlays';
import { useSettingsStore } from '@/lib/store/settingsStore';

import { celebrationFor, parseCelebrated, type StreakCelebration } from './celebration';
import { entryStreak, type StreakState } from './streak';

/** Every day with an entry, taken once per data version from the entries the insights read anyway. */
export function readEntryDays(): ReadonlySet<string> {
  return cached('entryDays', () => new Set(readInsightEntries().map((entry) => entry.date)));
}

export function readStreak(today: DateString): StreakState {
  return entryStreak(readEntryDays(), today);
}

/**
 * Runs a save from the entry editor and celebrates what it did to the streak: the overlay store
 * takes the celebration, the settings the new record. The only place a celebration starts, so
 * opening the app, an import or the sample data never celebrate. `write` has to go through
 * `mutate`, so the streak after it is read fresh.
 */
export function celebrateSave(write: () => void): StreakCelebration | null {
  const day = currentDay();
  const before = readStreak(day);
  write();
  const settings = useSettingsStore.getState();
  const outcome = celebrationFor(before, readStreak(day), parseCelebrated(settings.settings?.streak_celebrated));
  if (!outcome) return null;
  if (outcome.record) settings.update({ streak_celebrated: JSON.stringify(outcome.record) });
  useOverlayStore.getState().celebrate(outcome.celebration);
  return outcome.celebration;
}
