import { addDaysToDateString, type DateString } from '@/lib/dates';
import type { IconName } from '@/lib/icons';
import { weekStart } from '@/lib/insights/swings';

/**
 * Achievements reward keeping the diary, never how a day went: nothing here looks at a mood level.
 * Everything is worked out from the data on every read, nothing is stored, so an import or a
 * restored backup brings its stars along and deleting an entry can take one away again.
 */

/** Stars per achievement. */
export const TIER_COUNT = 5;
/** A week counts towards "weeks in a row" with entries on at least this many of its days. */
export const WEEK_MIN_DAYS = 5;
/** Window for the "within a week" achievements. */
export const WINDOW_DAYS = 7;

export type AchievementGroup = 'streaks' | 'volume';
export type AchievementUnit = 'days' | 'weeks' | 'words' | 'activities' | 'photos' | 'opens';
/** A run of days or weeks, the best seven days in a row, or a plain total. */
export type AchievementMeasure = 'run' | 'window' | 'total';

export type AchievementKey =
  | 'days'
  | 'weeks'
  | 'activityDays'
  | 'noteDays'
  | 'photoDays'
  | 'sleepDays'
  | 'stepDays'
  | 'totalDays'
  | 'weekWords'
  | 'chips'
  | 'weekChips'
  | 'variety'
  | 'custom'
  | 'photos'
  | 'scaleDays'
  | 'opens';

interface Definition {
  key: AchievementKey;
  group: AchievementGroup;
  unit: AchievementUnit;
  measure: AchievementMeasure;
  icon: IconName;
  /** Five rising thresholds, one per star. */
  tiers: readonly [number, number, number, number, number];
  /** Comes from Health Connect, so it stays out of reach without it. */
  health?: boolean;
}

const RUN_TIERS = [3, 14, 60, 180, 365] as const;

export const DEFINITIONS: readonly Definition[] = [
  // From one day up to five years (365 * 5 + one leap day).
  { key: 'days', group: 'streaks', measure: 'run', unit: 'days', icon: 'calendar-check-outline', tiers: [1, 14, 100, 365, 1826] },
  { key: 'weeks', group: 'streaks', measure: 'run', unit: 'weeks', icon: 'calendar-week', tiers: [2, 8, 26, 52, 104] },
  { key: 'activityDays', group: 'streaks', measure: 'run', unit: 'days', icon: 'shape-outline', tiers: RUN_TIERS },
  { key: 'noteDays', group: 'streaks', measure: 'run', unit: 'days', icon: 'notebook-edit-outline', tiers: [3, 7, 30, 100, 365] },
  { key: 'photoDays', group: 'streaks', measure: 'run', unit: 'days', icon: 'camera-outline', tiers: [1, 7, 30, 100, 365] },
  { key: 'sleepDays', group: 'streaks', measure: 'run', unit: 'days', icon: 'sleep', tiers: RUN_TIERS, health: true },
  { key: 'stepDays', group: 'streaks', measure: 'run', unit: 'days', icon: 'shoe-print', tiers: RUN_TIERS, health: true },
  { key: 'totalDays', group: 'volume', measure: 'total', unit: 'days', icon: 'calendar-multiple-check', tiers: [7, 30, 100, 365, 1000] },
  { key: 'weekWords', group: 'volume', measure: 'window', unit: 'words', icon: 'text-long', tiers: [100, 500, 1500, 4000, 10000] },
  { key: 'chips', group: 'volume', measure: 'total', unit: 'activities', icon: 'tag-multiple-outline', tiers: [10, 100, 500, 2500, 10000] },
  { key: 'weekChips', group: 'volume', measure: 'window', unit: 'activities', icon: 'tag-plus-outline', tiers: [10, 25, 50, 100, 150] },
  { key: 'variety', group: 'volume', measure: 'total', unit: 'activities', icon: 'palette-outline', tiers: [5, 15, 30, 60, 100] },
  { key: 'custom', group: 'volume', measure: 'total', unit: 'activities', icon: 'plus-box-multiple-outline', tiers: [1, 5, 15, 30, 50] },
  { key: 'photos', group: 'volume', measure: 'total', unit: 'photos', icon: 'image-multiple-outline', tiers: [1, 10, 50, 200, 1000] },
  { key: 'scaleDays', group: 'volume', measure: 'total', unit: 'days', icon: 'tune-variant', tiers: [1, 10, 50, 200, 500] },
  // The first opening is a given, so the first star waits for the second.
  { key: 'opens', group: 'volume', measure: 'total', unit: 'opens', icon: 'door-open', tiers: [2, 50, 365, 1500, 5000] },
];

export const MAX_STARS = DEFINITIONS.length * TIER_COUNT;

/** What the achievements need from one stored entry. `EntryDetails` fits as it is. */
export interface AchievementEntry {
  date: string;
  activity_ids: readonly number[];
  note_title?: string | null;
  note?: string | null;
  photos: readonly string[];
  scales: readonly unknown[];
}

export interface AchievementHealthDay {
  date: string;
  steps: number | null;
  sleep_minutes: number | null;
}

export interface AchievementInput {
  entries: readonly AchievementEntry[];
  health: readonly AchievementHealthDay[];
  /** Every activity ever created and still there, archived ones included. */
  activities: readonly { name: string }[];
  isStarter: (name: string) => boolean;
  /** Times the app was opened on this device. */
  opens: number;
  today: DateString;
  firstDayOfWeek: number;
}

export interface Achievement extends Definition {
  /** Best value ever reached; stars come from this, so a broken run keeps what it earned. */
  best: number;
  /** The run still going or the last seven days; null where only a total makes sense. */
  current: number | null;
  /** 0..5. */
  stars: number;
  /** Threshold of the next star, null once all five are there. */
  next: number | null;
  /** 0..1 of the way from nothing to the fifth star's threshold, from `best`, so it never drops. */
  progress: number;
}

/** Letters and digits; everything else splits words. */
const WORD = /[0-9A-Za-zÀ-ÖØ-öø-ÿĀ-ſ]+/g;

export function countWords(text: string): number {
  return text.match(WORD)?.length ?? 0;
}

interface Run {
  longest: number;
  /** The run ending today, or yesterday while today has nothing yet. */
  current: number;
}

/** Longest run of consecutive days among `dates`, and the one still going on `today`. */
export function dayRuns(dates: Iterable<string>, today: DateString): Run {
  const sorted = [...new Set(dates)].sort();
  let longest = 0;
  let length = 0;
  let previous: string | null = null;
  for (const date of sorted) {
    length = previous !== null && addDaysToDateString(previous as DateString, 1) === date ? length + 1 : 1;
    longest = Math.max(longest, length);
    previous = date;
  }
  const last = sorted.at(-1);
  const yesterday = addDaysToDateString(today, -1);
  const current = last === today || last === yesterday ? length : 0;
  return { longest, current };
}

/**
 * Weeks in a row with entries on at least `WEEK_MIN_DAYS` days. The week still running does not
 * break the run before it reaches the mark, just as an empty today does not break a day run.
 */
export function weekRuns(dates: Iterable<string>, today: DateString, firstDayOfWeek: number): Run {
  const perWeek = new Map<string, number>();
  for (const date of new Set(dates)) {
    const start = weekStart(date as DateString, firstDayOfWeek);
    perWeek.set(start, (perWeek.get(start) ?? 0) + 1);
  }
  const full = [...perWeek].filter(([, days]) => days >= WEEK_MIN_DAYS).map(([start]) => start).sort();
  let longest = 0;
  let length = 0;
  let previous: string | null = null;
  for (const start of full) {
    length = previous !== null && addDaysToDateString(previous as DateString, 7) === start ? length + 1 : 1;
    longest = Math.max(longest, length);
    previous = start;
  }
  const thisWeek = weekStart(today, firstDayOfWeek);
  const last = full.at(-1);
  const current = last === thisWeek || last === addDaysToDateString(thisWeek, -7) ? length : 0;
  return { longest, current };
}

/** Highest sum over any `WINDOW_DAYS` days in a row, and the sum of the last `WINDOW_DAYS` up to `today`. */
export function windowSums(values: ReadonlyMap<string, number>, today: DateString): { best: number; current: number } {
  const sorted = [...values].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  let best = 0;
  let sum = 0;
  let start = 0;
  for (const [date, value] of sorted) {
    sum += value;
    const from = addDaysToDateString(date as DateString, -(WINDOW_DAYS - 1));
    while (sorted[start]![0] < from) sum -= sorted[start++]![1];
    best = Math.max(best, sum);
  }
  const from = addDaysToDateString(today, -(WINDOW_DAYS - 1));
  const current = sorted.reduce((total, [date, value]) => (date >= from && date <= today ? total + value : total), 0);
  return { best, current };
}

function starsFor(tiers: readonly number[], value: number): number {
  return tiers.filter((tier) => value >= tier).length;
}

function finish(definition: Definition, best: number, current: number | null): Achievement {
  const stars = starsFor(definition.tiers, best);
  const next = definition.tiers[stars] ?? null;
  const goal = definition.tiers[TIER_COUNT - 1]!;
  return { ...definition, best, current, stars, next, progress: Math.min(1, best / goal) };
}

/** Every achievement in the order of `DEFINITIONS`. */
export function buildAchievements(input: AchievementInput): Achievement[] {
  const { today } = input;
  const days = new Set<string>();
  const activityDays = new Set<string>();
  const noteDays = new Set<string>();
  const photoDays = new Set<string>();
  const scaleDays = new Set<string>();
  const words = new Map<string, number>();
  const chipsPerDay = new Map<string, number>();
  const used = new Set<number>();
  let chips = 0;
  let photos = 0;

  for (const entry of input.entries) {
    const { date } = entry;
    days.add(date);
    if (entry.activity_ids.length > 0) activityDays.add(date);
    if (entry.photos.length > 0) photoDays.add(date);
    if (entry.scales.length > 0) scaleDays.add(date);
    const count = countWords(`${entry.note_title ?? ''} ${entry.note ?? ''}`);
    if (count > 0) {
      noteDays.add(date);
      words.set(date, (words.get(date) ?? 0) + count);
    }
    chips += entry.activity_ids.length;
    chipsPerDay.set(date, (chipsPerDay.get(date) ?? 0) + entry.activity_ids.length);
    for (const id of entry.activity_ids) used.add(id);
    photos += entry.photos.length;
  }

  const sleep = input.health.filter((day) => (day.sleep_minutes ?? 0) > 0).map((day) => day.date);
  const steps = input.health.filter((day) => (day.steps ?? 0) > 0).map((day) => day.date);
  const custom = input.activities.filter((activity) => !input.isStarter(activity.name)).length;

  const fromRun = (run: Run) => [run.longest, run.current] as const;
  const fromWindow = (sums: { best: number; current: number }) => [sums.best, sums.current] as const;
  const values: Record<AchievementKey, readonly [number, number | null]> = {
    days: fromRun(dayRuns(days, today)),
    weeks: fromRun(weekRuns(days, today, input.firstDayOfWeek)),
    activityDays: fromRun(dayRuns(activityDays, today)),
    noteDays: fromRun(dayRuns(noteDays, today)),
    photoDays: fromRun(dayRuns(photoDays, today)),
    sleepDays: fromRun(dayRuns(sleep, today)),
    stepDays: fromRun(dayRuns(steps, today)),
    totalDays: [days.size, null],
    weekWords: fromWindow(windowSums(words, today)),
    chips: [chips, null],
    weekChips: fromWindow(windowSums(chipsPerDay, today)),
    variety: [used.size, null],
    custom: [custom, null],
    photos: [photos, null],
    scaleDays: [scaleDays.size, null],
    opens: [input.opens, null],
  };

  return DEFINITIONS.map((definition) => {
    const [best, current] = values[definition.key];
    return finish(definition, best, current);
  });
}

export function totalStars(achievements: readonly Achievement[]): number {
  return achievements.reduce((sum, achievement) => sum + achievement.stars, 0);
}
