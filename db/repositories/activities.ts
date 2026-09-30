import { and, asc, count, eq, max, ne, sql } from 'drizzle-orm';

import { FALLBACK_ACTIVITY_ICON } from '@/lib/icons';
import { fold } from '@/lib/search/fold';

import { activities, activityGroups, entryActivities, plannedActivities, type Activity } from '../schema';
import { NameTakenError, RepositoryError, type Database } from '../types';
import { assertName } from '../validate';
import { writeOrder } from './order';

/** All activities in display order: group order first, then the order inside the group. */
export function listActivities(db: Database, options: { includeArchived?: boolean } = {}): Activity[] {
  return db
    .select({ activity: activities })
    .from(activities)
    .innerJoin(activityGroups, eq(activities.group_id, activityGroups.id))
    .where(options.includeArchived ? undefined : eq(activities.archived, false))
    .orderBy(asc(activityGroups.sort_order), asc(activityGroups.id), asc(activities.sort_order), asc(activities.id))
    .all()
    .map((row) => row.activity);
}

export function getActivity(db: Database, id: number): Activity | undefined {
  return db.select().from(activities).where(eq(activities.id, id)).get();
}

function nextSortOrder(db: Database, groupId: number): number {
  const last = db.select({ value: max(activities.sort_order) }).from(activities).where(eq(activities.group_id, groupId)).get()?.value;
  return (last ?? -1) + 1;
}

/** Another activity in the group whose folded name equals `name`, archived ones included. */
function sameNameInGroup(db: Database, groupId: number, name: string, exceptId?: number): Activity | undefined {
  return db
    .select()
    .from(activities)
    .where(and(eq(activities.group_id, groupId), exceptId === undefined ? undefined : ne(activities.id, exceptId)))
    .all()
    .find((activity) => fold(activity.name) === fold(name));
}

/** Returns the existing activity when the group already has one with the same folded name. */
export function createActivity(
  db: Database,
  input: { group_id: number; name: string; icon?: string; sort_order?: number },
): Activity {
  const name = assertName(input.name);
  const existing = sameNameInGroup(db, input.group_id, name);
  if (existing) return existing;
  return db
    .insert(activities)
    .values({ group_id: input.group_id, name, icon: input.icon ?? FALLBACK_ACTIVITY_ICON, sort_order: input.sort_order ?? nextSortOrder(db, input.group_id) })
    .returning()
    .get();
}

/**
 * Renames, re-icons, archives or moves an activity. A move to another group puts it at the end of
 * that group. Throws `NameTakenError` when the group already has an activity with that folded
 * name; the way out is merging the two.
 */
export function updateActivity(
  db: Database,
  id: number,
  patch: Partial<Pick<Activity, 'group_id' | 'name' | 'icon' | 'sort_order' | 'archived'>>,
): Activity {
  const current = getActivity(db, id);
  if (!current) throw new RepositoryError(`activity ${id} not found`);
  const clean = { ...patch };
  if (clean.name !== undefined) clean.name = assertName(clean.name);
  const name = clean.name ?? current.name;
  const groupId = clean.group_id ?? current.group_id;
  const moved = groupId !== current.group_id;
  if ((moved || name !== current.name) && sameNameInGroup(db, groupId, name, id)) throw new NameTakenError(name);
  if (moved && clean.sort_order === undefined) clean.sort_order = nextSortOrder(db, groupId);
  return db.update(activities).set(clean).where(eq(activities.id, id)).returning().get();
}

/** Writes the order of the activities of one group as listed. */
export function reorderActivities(db: Database, orderedIds: readonly number[]): void {
  writeOrder(db, activities, orderedIds);
}

/** How many entries carry each activity. Activities without any are absent. */
export function activityUsage(db: Database): Map<number, number> {
  const rows = db
    .select({ id: entryActivities.activity_id, n: count() })
    .from(entryActivities)
    .groupBy(entryActivities.activity_id)
    .all();
  return new Map(rows.map((row) => [row.id, row.n]));
}

/**
 * Folds `fromId` into `intoId`: every entry and plan that had `from` gets `into` (once, even where
 * it already had both), then `from` is deleted. One transaction. Returns how many entries had `from`.
 */
export function mergeActivities(db: Database, fromId: number, intoId: number): number {
  if (fromId === intoId) throw new RepositoryError('cannot merge an activity into itself');
  return db.transaction((tx) => {
    if (!getActivity(tx, fromId) || !getActivity(tx, intoId)) throw new RepositoryError('activity to merge not found');
    const moved = tx.select({ n: count() }).from(entryActivities).where(eq(entryActivities.activity_id, fromId)).get()?.n ?? 0;
    tx.run(
      sql`INSERT OR IGNORE INTO entry_activities (entry_id, activity_id) SELECT entry_id, ${intoId} FROM entry_activities WHERE activity_id = ${fromId}`,
    );
    tx.run(
      sql`INSERT OR IGNORE INTO planned_activities (date, activity_id) SELECT date, ${intoId} FROM planned_activities WHERE activity_id = ${fromId}`,
    );
    tx.delete(entryActivities).where(eq(entryActivities.activity_id, fromId)).run();
    tx.delete(plannedActivities).where(eq(plannedActivities.activity_id, fromId)).run();
    tx.delete(activities).where(eq(activities.id, fromId)).run();
    return moved;
  });
}
