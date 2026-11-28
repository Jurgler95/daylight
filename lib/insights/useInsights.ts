import { getDb } from '@/db';
import { listEntryDetails, type EntryDetails } from '@/db/repositories/entries';
import { listHealthDays } from '@/db/repositories/health';
import { listTurningPoints } from '@/db/repositories/turningPoints';
import type { MoodLevel } from '@/db/schema';
import type { DateString } from '@/lib/dates';
import { cached, useQuery } from '@/lib/store/dataVersion';
import { useSettingsStore } from '@/lib/store/settingsStore';

import { buildDays, dayTexts, type InsightDay } from './days';
import { activityDetail, levelDetail, type ActivityDetail, type LevelDetail } from './detail';
import { healthMood, type HealthMood } from './health';
import { healthStats, type HealthStats } from './healthStats';
import { buildInsights, type Insights } from './overview';
import type { InsightRange } from './range';
import { compareScales, scaleHealthLinks, scalePairLinks, scaleStats, type ScaleComparison, type ScaleFacts, type ScaleHealthLink, type ScaleInsight, type ScalePairLink } from './scales';
import { buildTrends, type TrendItem } from './trends';
import { scaleWords, wordDetail, type ScaleWords, type WordDetail } from './words';

/** Every entry with its level and activities, read once per data version for all insight screens. */
export function readInsightEntries(): EntryDetails[] {
  return cached('insightEntries', () => listEntryDetails(getDb()));
}

/** Every day of the diary, oldest first; the unit the detail pages count in. */
export function readInsightDays(): InsightDay[] {
  return cached('insightDays', () => buildDays(readInsightEntries()));
}

/** Title and note of every day, joined, read once per data version. */
export function readInsightTexts(): Map<DateString, string> {
  return cached('insightTexts', () => dayTexts(readInsightEntries()));
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

/** Each scale with values in the range of "Einblicke", in display order. */
export function useScaleInsights(insights: Insights, scales: readonly ScaleFacts[]): ScaleInsight[] {
  return useQuery(() => scaleStats({ scales, allDays: insights.allDays, window: insights.window, previous: insights.previous }), [insights, scales]);
}

/** Words on days with a high and a low value of the scale, for the range of "Einblicke". */
export function useScaleWords(insights: Insights, scale: ScaleFacts | undefined): ScaleWords | null {
  return useQuery(() => (scale ? scaleWords(insights.days, readInsightTexts(), scale) : null), [insights, scale]);
}

/** One word over the whole diary, like the page of an activity. */
export function useWordDetail(word: string, scales: readonly ScaleFacts[]): WordDetail {
  return useQuery(() => wordDetail(readInsightDays(), readInsightTexts(), word, scales), [word, scales]);
}

export interface ScaleRelations {
  pairs: ScalePairLink[];
  /** Empty while nothing came from Health Connect. */
  health: ScaleHealthLink[];
}

/** How the scales go with each other and with the health values, for the range of "Einblicke". */
export function useScaleRelations(insights: Insights, scales: readonly ScaleFacts[], today: DateString): ScaleRelations {
  return useQuery(() => {
    const rows = cached('healthDays', () => listHealthDays(getDb()));
    return { pairs: scalePairLinks(insights.days, scales), health: rows.length ? scaleHealthLinks(insights.days, scales, rows, today) : [] };
  }, [insights, scales, today]);
}

/** Scales on the days with an activity against all other days, over the whole diary like the rest of its page. */
export function useActivityScales(activityId: number, scales: readonly ScaleFacts[]): ScaleComparison[] {
  return useQuery(() => compareScales(readInsightDays(), scales, (day) => day.activities.has(activityId)), [activityId, scales]);
}

/** Scales on the days at a mood level against all other days. */
export function useLevelScales(level: MoodLevel, scales: readonly ScaleFacts[]): ScaleComparison[] {
  return useQuery(() => compareScales(readInsightDays(), scales, (day) => day.level === level), [level, scales]);
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
      mood: healthMood(insights.days, rows, today),
      stats: healthStats({ health: rows, allDays: insights.allDays, window: insights.window, previous: insights.previous, today }),
    };
  }, [insights, today]);
}

/** Where mood, scales and health values head over the last weeks; the range picked does not matter. */
export function useTrends(insights: Insights, scales: readonly ScaleFacts[], today: DateString): TrendItem[] {
  return useQuery(
    () =>
      buildTrends({
        allDays: insights.allDays,
        scales,
        health: cached('healthDays', () => listHealthDays(getDb())),
        turningPoints: cached('turningPoints', () => listTurningPoints(getDb())),
        today,
      }),
    [insights.allDays, scales, today],
  );
}
