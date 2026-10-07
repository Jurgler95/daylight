import { chunked } from '@/db/chunks';
import { listEntryDetails } from '@/db/repositories/entries';
import { addPhotos } from '@/db/repositories/photos';
import { activities, activityGroups, entries, entryActivities, entryScales, moods, plannedActivities, scales, turningPoints } from '@/db/schema';
import type { Database } from '@/db/types';
import { entryKey } from '@/lib/daylio/plan';
import { readCatalog } from '@/lib/daylio/apply';
import { fold } from '@/lib/search/fold';
import { onEntryDays, roomInYear } from '@/lib/turning/rules';

import type { ExportPayload } from './schema';

/**
 * Merge side of the JSON import. Rows are matched by meaning, not by id: groups and scales by
 * folded name, moods by folded label and level, activities by group and folded name, entries by
 * date, time, mood level and note. Unmatched rows are added with fresh ids; settings stay as they are.
 */

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
  const groups = new Map(payload.activity_groups.map((group) => [group.id, catalog.groups.find((g) => fold(g.name) === fold(group.name))?.id ?? null]));
  const moodMatches = new Map(
    payload.moods.map((mood) => [mood.id, catalog.moods.find((m) => fold(m.label) === fold(mood.label) && m.level === mood.level)?.id ?? null]),
  );
  const activityMatches = new Map(
    payload.activities.map((activity) => {
      const groupId = groups.get(activity.group_id) ?? null;
      const match = groupId === null ? undefined : catalog.activities.find((a) => a.group_id === groupId && fold(a.name) === fold(activity.name));
      return [activity.id, match?.id ?? null];
    }),
  );
  const scaleMatches = new Map(payload.scales.map((scale) => [scale.id, catalog.scales.find((s) => fold(s.name) === fold(scale.name))?.id ?? null]));

  const moodLevels = levels(payload);
  const seen = new Set(catalog.entryKeys);
  const newEntries: ExportPayload['entries'] = [];
  let duplicates = 0;
  for (const entry of payload.entries) {
    const key = entryKey(entry.date, entry.time, moodLevels.get(entry.mood_id) ?? 0, entry.note);
    if (seen.has(key)) duplicates++;
    else newEntries.push(entry);
    seen.add(key);
  }
  return { moods: moodMatches, groups, activities: activityMatches, scales: scaleMatches, newEntries, duplicates };
}

const levels = (payload: ExportPayload) => new Map(payload.moods.map((mood) => [mood.id, mood.level]));

/**
 * Photos go to the new entry, or to the stored entry the payload entry matched, so merging a
 * backup into a journal that already has its entries (say from a CSV) still brings the photos.
 */
function attachPhotos(tx: Database, payload: ExportPayload, entryIds: ReadonlyMap<number, number>, moodLevels: ReadonlyMap<number, number>): void {
  if (payload.entry_photos.length === 0) return;
  const stored = new Map<string, number>();
  for (const entry of listEntryDetails(tx)) {
    const key = entryKey(entry.date, entry.time, entry.level, entry.note);
    if (!stored.has(key)) stored.set(key, entry.id);
  }
  const byEntry = new Map(payload.entries.map((entry) => [entry.id, entry]));
  const photos = [...payload.entry_photos].sort((a, b) => a.entry_id - b.entry_id || a.sort_order - b.sort_order);
  for (const photo of photos) {
    const entry = byEntry.get(photo.entry_id);
    const target =
      entryIds.get(photo.entry_id) ?? (entry ? stored.get(entryKey(entry.date, entry.time, moodLevels.get(entry.mood_id) ?? 0, entry.note)) : undefined);
    if (target !== undefined) addPhotos(tx, target, [photo.file_name]);
  }
}

/** Next free position at the end of a list. */
function nextOrder(rows: readonly { sort_order: number }[]): number {
  return rows.reduce((max, row) => Math.max(max, row.sort_order), -1) + 1;
}

/** Adds what is missing. Expects to run inside a transaction. */
export function mergeImport(tx: Database, payload: ExportPayload): { added: number; duplicates: number } {
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
  attachPhotos(tx, payload, entryIds, levels(payload));
  mergeTurningPoints(tx, payload);

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
