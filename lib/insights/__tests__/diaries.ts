import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import type { HealthDay } from '@/db/schema';
import { addDaysToDateString, type DateString } from '@/lib/dates';

import { buildDays, type EntryFacts } from '../days';
import type { LinkFactor, LinkLevel, LinksInput } from '../links';

/**
 * The 36 synthetic test diaries (`diaries/dev` and `diaries/held`) and what the two reference
 * implementations made of them (`expected/`). A diary knows its own truth: which factors really
 * move the mood, which only look like it, and which merely describe it. `dev` is the set the
 * methods were developed on, `held` was kept back until they were finished. Nothing here comes
 * from real data.
 */

export const SETS = ['dev', 'held'] as const;
export type DiarySet = (typeof SETS)[number];

export interface DiaryDay {
  date: string;
  /** One level per entry of the day. */
  mood: number[];
  activities: string[];
  scales?: Record<string, number>;
  health?: { steps?: number | null; sleep_minutes?: number | null };
}

export interface DiaryTruth {
  effects: { factor: string; lag: 0 | 1; direction: 'up' | 'down'; strength: string }[];
  confounded: { factor: string }[];
  descriptive: string[];
}

export interface Diary {
  activities: { name: string; group: string }[];
  scales: { name: string; min: number; max: number }[];
  days: DiaryDay[];
  truth: DiaryTruth;
}

/** One tested column as the reference reports it; factors are named "activity:Name", "scale:Name", "health:steps". */
export interface ExpectedLink {
  factor: string;
  lag: 0 | 1;
  direction: 'up' | 'down';
  level: LinkLevel | null;
  t: number;
  tmin: number;
  q: number;
}

export interface Expected {
  links: ExpectedLink[];
  /** One digit per day: the lower and upper end of the usual range that day. */
  lo: string;
  hi: string;
}

const HERE = __dirname;
const read = <T>(...parts: string[]): T => JSON.parse(readFileSync(path.join(HERE, ...parts), 'utf8')) as T;

export function diaryNames(set: DiarySet): string[] {
  return readdirSync(path.join(HERE, 'diaries', set))
    .filter((name) => name.endsWith('.json'))
    .sort();
}

export const loadDiary = (set: DiarySet, name: string) => read<Diary>('diaries', set, name);
export const loadExpected = (set: DiarySet, name: string) => read<Expected>('expected', set, name);
export const loadErfc = () => read<[x: number, value: number][]>('expected', 'erfc.json');

/** The diary as the app would hold it: entries, ids in the order of the diary's lists, health rows. */
export function diaryEntries(diary: Diary): EntryFacts[] {
  const activityIds = new Map(diary.activities.map((activity, i) => [activity.name, i + 1]));
  const scaleIds = new Map(diary.scales.map((scale, i) => [scale.name, i + 1]));
  return diary.days.flatMap((day) =>
    day.mood.map((level, i) => ({
      date: day.date,
      time: `${String(8 + i).padStart(2, '0')}:00`,
      level,
      // Everything a day carries hangs on its first entry; the day is the union anyway.
      activity_ids: i === 0 ? day.activities.map((name) => activityIds.get(name)!) : [],
      scales: i === 0 ? Object.entries(day.scales ?? {}).map(([name, value]) => ({ scale_id: scaleIds.get(name)!, value })) : [],
    })),
  );
}

export function diaryHealth(diary: Diary): HealthDay[] {
  return diary.days.flatMap((day) =>
    day.health && Object.keys(day.health).length
      ? [{ date: day.date, steps: day.health.steps ?? null, sleep_minutes: day.health.sleep_minutes ?? null, resting_hr: null, exercise_minutes: null, synced_at: '', restored: false }]
      : [],
  );
}

/**
 * What the links are worked out from. "Today" is the day after the last entry, so the last day's
 * steps count as they do in the reference. `marked` names the groups that describe the mood.
 */
export function diaryInput(diary: Diary, marked: readonly string[] = []): LinksInput {
  const last = diary.days[diary.days.length - 1]!.date as DateString;
  return {
    allDays: buildDays(diaryEntries(diary)),
    activities: diary.activities.map((activity, i) => ({ id: i + 1, describesMood: marked.includes(activity.group) })),
    scales: diary.scales.map((scale, i) => ({ id: i + 1, name: scale.name, min: scale.min, max: scale.max, kind: 'rating' as const, describesMood: false })),
    health: diaryHealth(diary),
    today: addDaysToDateString(last, 1),
  };
}

/** A factor of the app under the name the diary's truth and the reference use. */
export function factorName(diary: Diary, factor: LinkFactor): string {
  if (factor.kind === 'activity') return `activity:${diary.activities[factor.id - 1]!.name}`;
  if (factor.kind === 'scale') return `scale:${diary.scales[factor.id - 1]!.name}`;
  return factor.metric === 'sleep' ? 'health:sleep_minutes' : 'health:steps';
}
