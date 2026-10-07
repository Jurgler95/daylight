import { getDb } from '@/db';
import { listActivities } from '@/db/repositories';
import { listHealthDays } from '@/db/repositories/health';
import type { DateString } from '@/lib/dates';
import { isStarterActivity } from '@/lib/daylio/known';
import { readInsightEntries } from '@/lib/insights/useInsights';
import { cached, useQuery } from '@/lib/store/dataVersion';
import { readTurningPoints } from '@/lib/turning/useTurningPoints';
import { useSettingsStore } from '@/lib/store/settingsStore';

import { buildAchievements, type Achievement } from './achievements';

/** Every achievement, recomputed when data, day, first weekday or the number of app opens change. */
export function useAchievements(today: DateString): Achievement[] {
  const firstDayOfWeek = useSettingsStore((s) => s.settings?.first_day_of_week) ?? 1;
  const opens = useSettingsStore((s) => s.settings?.app_opens) ?? 0;
  return useQuery(
    () =>
      cached(`achievements:${today}:${firstDayOfWeek}:${opens}`, () => {
        const db = getDb();
        return buildAchievements({
          entries: readInsightEntries(),
          health: cached('healthDays', () => listHealthDays(db)),
          activities: listActivities(db, { includeArchived: true }),
          isStarter: isStarterActivity,
          opens,
          turningPoints: readTurningPoints().length,
          today,
          firstDayOfWeek,
        });
      }),
    [today, firstDayOfWeek, opens],
  );
}
