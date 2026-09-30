import { useCallback } from 'react';

import type { DateString } from '@/lib/dates';
import { readInsightDays } from '@/lib/insights/useInsights';
import { useQuery } from '@/lib/store/dataVersion';
import { useSettingsStore } from '@/lib/store/settingsStore';

import { showLowMoodNote } from './lowMood';

/** Whether the note shows today, and how to put it away for fourteen days. */
export function useLowMoodNote(today: DateString): { show: boolean; dismiss: () => void } {
  const dismissedOn = useSettingsStore((s) => s.settings?.low_mood_dismissed_on ?? null) as DateString | null;
  const update = useSettingsStore((s) => s.update);
  const show = useQuery(
    () => showLowMoodNote({ levels: new Map(readInsightDays().map((day) => [day.date, day.level])), today, dismissedOn }),
    [today, dismissedOn],
  );
  const dismiss = useCallback(() => update({ low_mood_dismissed_on: today }), [update, today]);
  return { show, dismiss };
}
