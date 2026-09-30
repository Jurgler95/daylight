import type { DateString } from '@/lib/dates';

import { activityCounts, activityPairs, type ActivityCount, type ActivityPair } from './activities';
import { beforeHardDays, type BeforeHardResult } from './beforeHard';
import { coverage, type Coverage } from './coverage';
import { buildDays, dayTexts, type EntryFacts, type InsightDay } from './days';
import { activityEffects, splitEffects, type SplitEffects } from './effects';
import { monthMeans, moodDistribution, moodSeries, overallMean, type LevelShare, type MonthMean, type MoodPoint } from './mood';
import { pixelYears } from './pixels';
import { daysIn, previousWindow, rangeWindow, type DayWindow, type InsightRange } from './range';
import { goodStreaks, weeklySwings, type Streaks, type Swings } from './swings';
import { weekdayProfile, type WeekdayProfile } from './weekdays';
import { noteWords, type NoteWords } from './words';

export interface InsightsInput {
  /** Every entry, any order. */
  entries: readonly EntryFacts[];
  range: InsightRange;
  today: DateString;
  /** 0 = Sunday, 1 = Monday, from the settings. */
  firstDayOfWeek: number;
}

/** Everything "Einblicke" shows for one range. Cards with too little data get empty lists or null, never NaN. */
export interface Insights {
  window: DayWindow;
  /** The window before, null when there is no full one to compare with. */
  previous: DayWindow | null;
  /** Every day of the diary, oldest first, for the year in pixels. */
  allDays: InsightDay[];
  /** Days inside the window, for the cards the screen builds per selection (group table). */
  days: InsightDay[];
  mean: number | null;
  series: MoodPoint[];
  distribution: LevelShare[];
  weekdays: WeekdayProfile;
  months: MonthMean[];
  swings: Swings;
  /** Longest run inside the window; the current run looks at the whole diary. */
  streaks: Streaks;
  counts: ActivityCount[];
  effects: SplitEffects;
  nextDay: SplitEffects;
  pairs: ActivityPair[];
  beforeHard: BeforeHardResult;
  words: NoteWords;
  coverage: Coverage | null;
  years: number[];
}

export function buildInsights({ entries, range, today, firstDayOfWeek }: InsightsInput): Insights {
  const allDays = buildDays(entries);
  const firstDate = allDays[0]?.date ?? null;
  const window = rangeWindow(range, today, firstDate);
  const previous = previousWindow(range, window, firstDate);
  const days = daysIn(allDays, window);
  const before = previous ? daysIn(allDays, previous) : null;
  return {
    window,
    previous,
    allDays,
    days,
    mean: overallMean(days),
    series: moodSeries(allDays, window),
    distribution: moodDistribution(days, before),
    weekdays: weekdayProfile(days),
    months: monthMeans(days),
    swings: weeklySwings(days, firstDayOfWeek),
    // One pass over the whole diary, so a run that began before the window keeps its full length.
    streaks: goodStreaks(allDays, today, window.from),
    counts: activityCounts(days, before),
    effects: splitEffects(activityEffects(days)),
    nextDay: splitEffects(activityEffects(days, { lag: 1 })),
    pairs: activityPairs(days),
    beforeHard: beforeHardDays(days),
    words: noteWords(days, dayTexts(entries)),
    coverage: coverage(entries, window, firstDate),
    years: pixelYears(allDays),
  };
}
