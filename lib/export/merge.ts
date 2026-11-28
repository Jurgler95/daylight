import { chunked } from '@/db/chunks';
import { addPhotos } from '@/db/repositories/photos';
import {
  activities,
  activityGroups,
  entries,
  entryActivities,
  entryScales,
  experimentDays,
  experiments,
  moods,
  plannedActivities,
  scales,
  turningPoints,
} from '@/db/schema';
import type { Database } from '@/db/types';
import { today as todayDate, type DateString } from '@/lib/dates';
import { entryIdsByKey, readCatalog } from '@/lib/daylio/apply';
import { isStandardMood, standardActivityKey, standardGroupKey } from '@/lib/daylio/known';
import type { Catalog } from '@/lib/daylio/plan';
import { entryKey, takeKey } from '@/lib/daylio/plan';
import { experimentKey, type ExperimentSpan } from '@/lib/experiments/rules';
import { fold } from '@/lib/search/fold';
import { onEntryDays, roomInYear } from '@/lib/turning/rules';

import type { ExportPayload } from './schema';

/**
 * Merge side of the JSON import. Rows are matched by meaning, not by id: groups by folded name,
 * scales by folded name and kind, moods by folded label and level, activities by group and folded name,
 * and what the app brought (standard moods, groups and activities) by its slot in any language, entries by
 * date, time, mood level, note title, note and activity names (`entryKey`). Unmatched rows are added with fresh ids; settings stay as they are.
 */

/** Active rows first, then in list order: a standard name finds the row the editor shows. */
function shownFirst<T extends { archived: boolean; sort_order: number; id: number }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => Number(a.archived) - Number(b.archived) || a.sort_order - b.sort_order || a.id - b.id);
}

/**
 * A standard mood (the app's name for its level in any language) is the standard mood of that level
 * here, so "Gut" from a German backup lands on "Good". A mood of the user's own needs name and level.
 */
function matchMood<T extends { id: number; label: string; level: number; archived: boolean; sort_order: number }>(
  stored: readonly T[],
  mood: { label: string; level: number },
): T | undefined {
  const same = stored.find((m) => fold(m.label) === fold(mood.label) && m.level === mood.level);
  if (same || !isStandardMood(mood.label, mood.level)) return same;
  return shownFirst(stored).find((m) => m.level === mood.level && isStandardMood(m.label, m.level));
}

/** By folded name, and a standard group by its slot in any language ("Schlaf" is "Sleep"). */
function matchGroup<T extends { id: number; name: string }>(stored: readonly T[], name: string): T | undefined {
  const same = stored.find((g) => fold(g.name) === fold(name));
  const key = standardGroupKey(name);
  if (same || key === null) return same;
  return stored.find((g) => standardGroupKey(g.name) === key);
}

/** By folded name inside the group, and a standard activity of a standard group by its slot ("Müde" is "Tired"). */
function matchActivity(catalog: Catalog, groupId: number, name: string, payloadGroup: string): Catalog['activities'][number] | undefined {
  const inGroup = catalog.activities.filter((a) => a.group_id === groupId);
  const same = inGroup.find((a) => fold(a.name) === fold(name));
  const groupKey = standardGroupKey(payloadGroup);
  const slot = standardActivityKey(name, groupKey);
  if (same || slot === null) return same;
  const storedGroup = catalog.groups.find((g) => g.id === groupId);
  if (!storedGroup || standardGroupKey(storedGroup.name) !== groupKey) return undefined;
  return inGroup.find((a) => standardActivityKey(a.name, groupKey) === slot);
}

export interface Matches {
  /** Payload id to existing id, or null when the row is new. */
  moods: Map<number, number | null>;
  groups: Map<number, number | null>;
  activities: Map<number, number | null>;
  scales: Map<number, number | null>;
  /** Payload entries to add, in payload order. */
  newEntries: ExportPayload['entries'];
  duplicates: number;
}

export function matchPayload(db: Database, payload: ExportPayload): Matches {
  const catalog = readCatalog(db);
  const groups = new Map(payload.activity_groups.map((group) => [group.id, matchGroup(catalog.groups, group.name)?.id ?? null]));
  const moodMatches = new Map(payload.moods.map((mood) => [mood.id, matchMood(catalog.moods, mood)?.id ?? null]));
  const payloadGroups = new Map(payload.activity_groups.map((group) => [group.id, group.name]));
  const activityMatches = new Map(
    payload.activities.map((activity) => {
      const groupId = groups.get(activity.group_id) ?? null;
      const match = groupId === null ? undefined : matchActivity(catalog, groupId, activity.name, payloadGroups.get(activity.group_id) ?? '');
      return [activity.id, match?.id ?? null];
    }),
  );
  // A duration never takes the place of a rating of the same name, or minutes would land on a 1 to 5 scale.
  const scaleMatches = new Map(
    payload.scales.map((scale) => [scale.id, catalog.scales.find((s) => fold(s.name) === fold(scale.name) && s.kind === scale.kind)?.id ?? null]),
  );

  const keyOf = payloadKeys(payload);
  const stored = new Map(catalog.entryKeys);
  const newEntries: ExportPayload['entries'] = [];
  let duplicates = 0;
  for (const entry of payload.entries) {
    if (takeKey(stored, keyOf(entry))) duplicates++;
    else newEntries.push(entry);
  }
  return { moods: moodMatches, groups, activities: activityMatches, scales: scaleMatches, newEntries, duplicates };
}

/** `entryKey` of a payload entry, with its mood level and activity names looked up in the payload. */
function payloadKeys(payload: ExportPayload): (entry: ExportPayload['entries'][number]) => string {
  const levels = new Map(payload.moods.map((mood) => [mood.id, mood.level]));
  const names = new Map(payload.activities.map((activity) => [activity.id, activity.name]));
  const activityNames = new Map<number, string[]>();
  for (const link of payload.entry_activities) {
    const name = names.get(link.activity_id) ?? '';
    const list = activityNames.get(link.entry_id);
    if (list) list.push(name);
    else activityNames.set(link.entry_id, [name]);
  }
  return (entry) =>
    entryKey({
      date: entry.date,
      time: entry.time,
      level: levels.get(entry.mood_id) ?? 0,
      noteTitle: entry.note_title,
      note: entry.note,
      activities: activityNames.get(entry.id) ?? [],
    });
}

/**
 * Photos go to the new entry, or to the stored entry the payload entry matched, so merging a
 * backup into a journal that already has its entries (say from a CSV) still brings the photos.
 */
function attachPhotos(tx: Database, payload: ExportPayload, entryIds: ReadonlyMap<number, number>): void {
  if (payload.entry_photos.length === 0) return;
  const stored = entryIdsByKey(tx);
  const keyOf = payloadKeys(payload);
  const byEntry = new Map(payload.entries.map((entry) => [entry.id, entry]));
  const photos = [...payload.entry_photos].sort((a, b) => a.entry_id - b.entry_id || a.sort_order - b.sort_order);
  for (const photo of photos) {
    const entry = byEntry.get(photo.entry_id);
    const target = entryIds.get(photo.entry_id) ?? (entry ? stored.get(keyOf(entry)) : undefined);
    if (target !== undefined) addPhotos(tx, target, [photo.file_name]);
  }
}

/** Next free position at the end of a list. */
function nextOrder(rows: readonly { sort_order: number }[]): number {
  return rows.reduce((max, row) => Math.max(max, row.sort_order), -1) + 1;
}

/** Adds what is missing. Expects to run inside a transaction. */
export function mergeImport(tx: Database, payload: ExportPayload, today: DateString = todayDate()): { added: number; duplicates: number } {
  const matches = matchPayload(tx, payload);
  const resolve = <T extends { id: number; sort_order: number }>(
    rows: readonly T[],
    found: Map<number, number | null>,
    existing: readonly { sort_order: number }[],
    insert: (row: Omit<T, 'id'>) => number,
  ) => {
    const ids = new Map<number, number>();
    let order = nextOrder(existing);
    for (const row of [...rows].sort((a, b) => a.sort_order - b.sort_order)) {
      const { id, ...rest } = row;
      ids.set(id, found.get(id) ?? insert({ ...rest, sort_order: order++ }));
    }
    return ids;
  };

  const groupIds = resolve(payload.activity_groups, matches.groups, tx.select().from(activityGroups).all(), (row) =>
    tx.insert(activityGroups).values(row).returning({ id: activityGroups.id }).get().id,
  );
  const moodIds = resolve(payload.moods, matches.moods, tx.select().from(moods).all(), (row) =>
    tx.insert(moods).values(row).returning({ id: moods.id }).get().id,
  );
  const scaleIds = resolve(payload.scales, matches.scales, tx.select().from(scales).all(), (row) =>
    tx.insert(scales).values(row).returning({ id: scales.id }).get().id,
  );
  const existingActivities = tx.select().from(activities).all();
  const activityIds = new Map<number, number>();
  for (const activity of [...payload.activities].sort((a, b) => a.sort_order - b.sort_order)) {
    const { id, ...rest } = activity;
    const groupId = groupIds.get(activity.group_id) as number;
    const found = matches.activities.get(id) ?? null;
    const order = nextOrder(existingActivities.filter((a) => a.group_id === groupId));
    const created = found ?? tx.insert(activities).values({ ...rest, group_id: groupId, sort_order: order }).returning().get();
    if (typeof created !== 'number') existingActivities.push(created);
    activityIds.set(id, typeof created === 'number' ? created : created.id);
  }

  const entryIds = new Map<number, number>();
  for (const entry of matches.newEntries) {
    const { id, ...rest } = entry;
    const inserted = tx.insert(entries).values({ ...rest, mood_id: moodIds.get(entry.mood_id) as number }).returning({ id: entries.id }).get();
    entryIds.set(id, inserted.id);
  }
  const links = payload.entry_activities.flatMap((link) => {
    const entryId = entryIds.get(link.entry_id);
    return entryId === undefined ? [] : [{ entry_id: entryId, activity_id: activityIds.get(link.activity_id) as number }];
  });
  for (const chunk of chunked(links)) tx.insert(entryActivities).values(chunk).onConflictDoNothing().run();
  const values = payload.entry_scales.flatMap((value) => {
    const entryId = entryIds.get(value.entry_id);
    return entryId === undefined ? [] : [{ entry_id: entryId, scale_id: scaleIds.get(value.scale_id) as number, value: value.value }];
  });
  for (const chunk of chunked(values)) tx.insert(entryScales).values(chunk).onConflictDoNothing().run();
  const plans = payload.planned_activities.map((plan) => ({ date: plan.date, activity_id: activityIds.get(plan.activity_id) as number }));
  for (const chunk of chunked(plans)) tx.insert(plannedActivities).values(chunk).onConflictDoNothing().run();
  attachPhotos(tx, payload, entryIds);
  mergeTurningPoints(tx, payload);
  mergeExperiments(tx, payload, today);

  return { added: matches.newEntries.length, duplicates: matches.duplicates };
}

/**
 * A turning point on a day that already has one stays as it is here. One that would push its year
 * past the cap is left out, so a merge never ends with more than the app would let anyone set.
 */
function mergeTurningPoints(tx: Database, payload: ExportPayload): void {
  const dates = tx.select({ date: turningPoints.date }).from(turningPoints).all().map((row) => row.date);
  for (const point of onEntryDays(payload.turning_points ?? [], payload.entries)) {
    if (dates.includes(point.date) || roomInYear(dates, point.date) === 0) continue;
    tx.insert(turningPoints).values(point).run();
    dates.push(point.date);
  }
}

/**
 * An experiment with the same folded title and exactly the same start is already here: it stays as
 * it is and only gets the "yes" answers it lacks, within its own span here. An answer after its end
 * would otherwise read as the "no" that ended it, and a "no" inside its span would stand there
 * without ending it. New ones get fresh ids and their answers follow; they
 * count as seen once their end lies before `today`, so merging an old backup brings no cards to
 * "Heute", while one that still runs or is planned gets its card when it is over.
 */
function mergeExperiments(tx: Database, payload: ExportPayload, today: DateString): void {
  if (!payload.experiments?.length) return;
  const here = tx.select().from(experiments).all();
  const stored = new Map(here.map((row) => [experimentKey(row), row.id]));
  /** The span of each experiment that was already here, by its id. */
  const spans = new Map<number, ExperimentSpan>(here.map((row) => [row.id, row]));
  const ids = new Map<number, number>();
  for (const experiment of payload.experiments) {
    const key = experimentKey(experiment);
    const existing = stored.get(key);
    if (existing !== undefined) {
      ids.set(experiment.id, existing);
      continue;
    }
    const { id, ...rest } = experiment;
    const inserted = tx
      .insert(experiments)
      .values({ ...rest, result_seen: experiment.end_date < today })
      .returning({ id: experiments.id })
      .get();
    stored.set(key, inserted.id);
    ids.set(id, inserted.id);
  }
  const answers = (payload.experiment_days ?? []).flatMap((answer) => {
    const experimentId = ids.get(answer.experiment_id);
    if (experimentId === undefined) return [];
    const span = spans.get(experimentId);
    // A "no" would end it, which only the editor does after asking; so an existing one takes only a "yes".
    if (span && (!answer.kept || answer.date < span.start_date || answer.date > span.end_date)) return [];
    return [{ ...answer, experiment_id: experimentId }];
  });
  for (const chunk of chunked(answers)) tx.insert(experimentDays).values(chunk).onConflictDoNothing().run();
}
