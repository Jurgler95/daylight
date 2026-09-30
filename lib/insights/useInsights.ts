import { getDb } from '@/db';
import { listEntryDetails, type EntryDetails } from '@/db/repositories/entries';
import { listHealthDays } from '@/db/repositories/health';
import type { MoodLevel } from '@/db/schema';
import type { DateString } from '@/lib/dates';
import { cached, useQuery } from '@/lib/store/dataVersion';
import { useSettingsStore } from '@/lib/store/settingsStore';

import { buildDays, type InsightDay } from './days';
import { activityDetail, levelDetail, type ActivityDetail, type LevelDetail } from './detail';
import { healthMood, type HealthMood } from './health';
import { healthStats, type HealthStats } from './healthStats';
import { buildInsights, type Insights } from './overview';
import type { InsightRange } from './range';

/** Every entry with its level and activities, read once per data version for all insight screens. */
export function readInsightEntries(): EntryDetails[] {
  return cached('insightEntries', () => listEntryDetails(getDb()));
}

/** Every day of the diary, oldest first; the unit the detail pages count in. */
export function readInsightDays(): InsightDay[] {
  return cached('insightDays', () => buildDays(readInsightEntries()));
}

/** Everything "Einblicke" shows for a range, recomputed when data, day, range or first weekday change. */
export function useInsights(range: InsightRange, today: DateString): Insights {
  const firstDayOfWeek = useSettingsStore((s) => s.settings?.first_day_of_week) ?? 1;
  return useQuery(
    () => cached(`insights:${range}:${today}:${firstDayOfWeek}`, () => buildInsights({ entries: readInsightEntries(), range, today, firstDayOfWeek })),
    [range, today, firstDayOfWeek],
  );
}

/** Over the whole diary, not the range picked on "Einblicke": a detail page is reached from several places. */
export function useActivityDetail(activityId: number): ActivityDetail {
  return useQuery(() => activityDetail(readInsightDays(), activityId), [activityId]);
}

export function useLevelDetail(level: MoodLevel): LevelDetail {
  return useQuery(() => levelDetail(readInsightDays(), level), [level]);
}

export interface HealthInsights {
  mood: HealthMood;
  stats: HealthStats;
}

/** Health values, and how they line up with mood and activities, for the range; null while nothing came from Health Connect. */
export function useHealthInsights(insights: Insights, today: DateString): HealthInsights | null {
  return useQuery(() => {
    const rows = cached('healthDays', () => listHealthDays(getDb()));
    if (rows.length === 0) return null;
    return {
      mood: healthMood(insights.days, rows),
      stats: healthStats({ health: rows, allDays: insights.allDays, window: insights.window, previous: insights.previous, today }),
    };
  }, [insights, today]);
}
