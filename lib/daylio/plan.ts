import type { MoodLevel } from '@/db/schema';
import type { DateString } from '@/lib/dates';
import { FALLBACK_ACTIVITY_ICON, type IconName } from '@/lib/icons';
import { fold } from '@/lib/search/fold';

import { knownActivity, knownMoodLevel, resolveGroupName } from './known';
import type { RawEntry } from './parse';

/**
 * Pure import planning: from raw records and what the database already holds, work out which
 * moods, groups, activities and scales are new, which entries would be added and which are
 * already there. No database access; `apply.ts` carries the plan out.
 */

/** The slice of the database the planner needs. */
export interface Catalog {
  moods: readonly { id: number; label: string; level: number; sort_order: number; archived: boolean }[];
  groups: readonly { id: number; name: string }[];
  /** In display order (group order, then order inside the group). */
  activities: readonly { id: number; group_id: number; name: string }[];
  scales: readonly { id: number; name: string }[];
  /** `entryKey` of every entry already stored. */
  entryKeys: ReadonlySet<string>;
  /** Photo file names already stored, so a second import of the same backup brings none twice. */
  photoNames: ReadonlySet<string>;
}

/** What the user picked in the import preview, keyed by folded name. */
export interface ImportChoices {
  moodLevels?: Readonly<Record<string, MoodLevel>>;
  activityGroups?: Readonly<Record<string, string>>;
}

export interface PlannedMood {
  key: string;
  label: string;
  level: MoodLevel;
  /** Existing mood the name resolves to, or null when a new one is created. */
  existingId: number | null;
  /** True when the level is a guess nobody confirmed (unknown custom name). */
  needsChoice: boolean;
  count: number;
}

export interface PlannedActivity {
  key: string;
  name: string;
  existingId: number | null;
  group: string;
  icon: IconName;
  /** Position in the order the file implies, used as sort order for new activities. */
  rank: number;
  count: number;
}

export interface ImportPlan {
  from: DateString | null;
  to: DateString | null;
  /** Valid records in the file. */
  entryCount: number;
  moods: PlannedMood[];
  activities: PlannedActivity[];
  /** Groups that have to be created, in the order they are first needed. */
  newGroups: string[];
  /** Scales to create, with a range wide enough for every value in the file (at least 0 to 10). */
  newScales: { name: string; min: number; max: number }[];
  /** Records that would be added, file order. */
  entries: { raw: RawEntry; key: string }[];
  /** Records already stored or repeated in the file. */
  duplicates: number;
  /** Photos in the file, and how many of them are not stored yet (they also go to existing entries). */
  photos: number;
  newPhotos: number;
}

/** Default level for a mood name nobody recognises, until the user picks one. */
export const UNKNOWN_MOOD_LEVEL: MoodLevel = 3;

/** An entry counts as already there when date, time, mood level and note all match. */
export function entryKey(date: string, time: string, level: number, note: string | null): string {
  return [date, time, level, note ?? ''].join('\u0001');
}

/**
 * The order the file implies for its activities. Daylio writes them in its own group and sort
 * order, so each row is a chain of "comes before" hints; a topological sort merges them, ties
 * and contradictions fall back to first appearance.
 */
export function fileOrder(lists: readonly (readonly string[])[]): string[] {
  const firstSeen = new Map<string, number>();
  for (const list of lists) for (const key of list) if (!firstSeen.has(key)) firstSeen.set(key, firstSeen.size);
  const after = new Map<string, Set<string>>([...firstSeen.keys()].map((key) => [key, new Set<string>()]));
  const incoming = new Map<string, number>([...firstSeen.keys()].map((key) => [key, 0]));
  for (const list of lists) {
    for (let i = 0; i + 1 < list.length; i++) {
      const [from, to] = [list[i] as string, list[i + 1] as string];
      const edges = after.get(from);
      if (from === to || !edges || edges.has(to)) continue;
      edges.add(to);
      incoming.set(to, (incoming.get(to) ?? 0) + 1);
    }
  }
  const remaining = new Set(firstSeen.keys());
  const byFirstSeen = (a: string, b: string) => (firstSeen.get(a) ?? 0) - (firstSeen.get(b) ?? 0);
  const order: string[] = [];
  while (remaining.size) {
    const candidates = [...remaining].sort(byFirstSeen);
    const next = candidates.find((key) => (incoming.get(key) ?? 0) === 0) ?? (candidates[0] as string);
    remaining.delete(next);
    order.push(next);
    for (const target of after.get(next) ?? []) incoming.set(target, (incoming.get(target) ?? 0) - 1);
  }
  return order;
}

function resolveMood(label: string, catalog: Catalog, choices: ImportChoices): Omit<PlannedMood, 'count'> {
  const key = fold(label);
  const moods = [...catalog.moods].sort((a, b) => Number(a.archived) - Number(b.archived) || a.sort_order - b.sort_order);
  const same = moods.find((mood) => fold(mood.label) === key);
  if (same) return { key, label, level: same.level as MoodLevel, existingId: same.id, needsChoice: false };
  const known = knownMoodLevel(label);
  const chosen = choices.moodLevels?.[key];
  // A standard name from the other language ("rad") lands on the mood of that level ("Super").
  const alias = known !== null && chosen === undefined ? moods.find((mood) => mood.level === known && !mood.archived) : undefined;
  if (alias) return { key, label, level: known as MoodLevel, existingId: alias.id, needsChoice: false };
  return { key, label, level: chosen ?? known ?? UNKNOWN_MOOD_LEVEL, existingId: null, needsChoice: chosen === undefined && known === null };
}

function resolveActivity(name: string, catalog: Catalog, choices: ImportChoices): Omit<PlannedActivity, 'count' | 'rank'> {
  const key = fold(name);
  const groupNames = catalog.groups.map((group) => group.name);
  const existing = catalog.activities.find((activity) => fold(activity.name) === key);
  if (existing) {
    const group = catalog.groups.find((g) => g.id === existing.group_id)?.name ?? resolveGroupName('imported', groupNames);
    return { key, name, existingId: existing.id, group, icon: FALLBACK_ACTIVITY_ICON };
  }
  const known = knownActivity(name);
  const chosen = choices.activityGroups?.[key];
  // "happy" goes to "Gefühle" or "Emotions", whichever of the two this journal has.
  const group = chosen ?? resolveGroupName(known?.group ?? 'imported', groupNames);
  return { key, name, existingId: null, group, icon: known?.icon ?? FALLBACK_ACTIVITY_ICON };
}

export function buildImportPlan(records: readonly RawEntry[], catalog: Catalog, choices: ImportChoices = {}): ImportPlan {
  const moods = new Map<string, PlannedMood>();
  const activities = new Map<string, Omit<PlannedActivity, 'rank'>>();
  const scaleRanges = new Map<string, { name: string; min: number; max: number }>();
  for (const record of records) {
    const moodKey = fold(record.mood);
    const mood = moods.get(moodKey) ?? { ...resolveMood(record.mood, catalog, choices), count: 0 };
    mood.count++;
    moods.set(moodKey, mood);
    for (const name of record.activities) {
      const key = fold(name);
      const activity = activities.get(key) ?? { ...resolveActivity(name, catalog, choices), count: 0 };
      activity.count++;
      activities.set(key, activity);
    }
    for (const scale of record.scales) {
      const range = scaleRanges.get(fold(scale.name)) ?? { name: scale.name, min: 0, max: 10 };
      scaleRanges.set(fold(scale.name), { ...range, min: Math.min(range.min, scale.value), max: Math.max(range.max, scale.value) });
    }
  }

  const order = fileOrder(records.map((record) => record.activities.map(fold)));
  const planned = order.flatMap((key, rank) => {
    const activity = activities.get(key);
    return activity ? [{ ...activity, rank }] : [];
  });

  const knownGroups = new Set(catalog.groups.map((group) => fold(group.name)));
  const newGroups: string[] = [];
  for (const activity of planned) {
    if (activity.existingId !== null || knownGroups.has(fold(activity.group))) continue;
    knownGroups.add(fold(activity.group));
    newGroups.push(activity.group);
  }

  const seen = new Set(catalog.entryKeys);
  const toAdd: ImportPlan['entries'] = [];
  let duplicates = 0;
  for (const record of records) {
    const level = moods.get(fold(record.mood))?.level ?? UNKNOWN_MOOD_LEVEL;
    const key = entryKey(record.date, record.time, level, record.note);
    if (seen.has(key)) duplicates++;
    else toAdd.push({ raw: record, key });
    seen.add(key);
  }

  const photoNames = records.flatMap((record) => record.photos);
  const dates = records.map((record) => record.date).sort();
  const existingScales = new Set(catalog.scales.map((scale) => fold(scale.name)));
  return {
    from: dates[0] ?? null,
    to: dates[dates.length - 1] ?? null,
    entryCount: records.length,
    moods: [...moods.values()],
    activities: planned,
    newGroups,
    newScales: [...scaleRanges].filter(([key]) => !existingScales.has(key)).map(([, range]) => range),
    entries: toAdd,
    duplicates,
    photos: photoNames.length,
    newPhotos: new Set(photoNames.filter((name) => !catalog.photoNames.has(name))).size,
  };
}
