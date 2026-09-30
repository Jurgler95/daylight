import { asc, eq, max } from 'drizzle-orm';

import { fold } from '@/lib/search/fold';

import { activityGroups, type ActivityGroup } from '../schema';
import { NameTakenError, type Database } from '../types';
import { assertName } from '../validate';
import { writeOrder } from './order';

export function listGroups(db: Database, options: { includeArchived?: boolean } = {}): ActivityGroup[] {
  return db
    .select()
    .from(activityGroups)
    .where(options.includeArchived ? undefined : eq(activityGroups.archived, false))
    .orderBy(asc(activityGroups.sort_order), asc(activityGroups.id))
    .all();
}

/** Finds a group by folded name (archived ones included), so "gefühle" is "Gefühle". */
export function findGroupByName(db: Database, name: string): ActivityGroup | undefined {
  const key = fold(name.trim());
  return listGroups(db, { includeArchived: true }).find((group) => fold(group.name) === key);
}

/** Returns the existing group when the folded name is already taken. */
export function createGroup(db: Database, name: string): ActivityGroup {
  const clean = assertName(name);
  const existing = findGroupByName(db, clean);
  if (existing) return existing;
  const last = db.select({ value: max(activityGroups.sort_order) }).from(activityGroups).get()?.value ?? -1;
  return db.insert(activityGroups).values({ name: clean, sort_order: last + 1 }).returning().get();
}

/** Throws `NameTakenError` when another group already has the folded name. */
export function updateGroup(db: Database, id: number, patch: Partial<Pick<ActivityGroup, 'name' | 'sort_order' | 'archived'>>): ActivityGroup {
  const clean = { ...patch };
  if (clean.name !== undefined) {
    clean.name = assertName(clean.name);
    const other = findGroupByName(db, clean.name);
    if (other && other.id !== id) throw new NameTakenError(clean.name);
  }
  return db.update(activityGroups).set(clean).where(eq(activityGroups.id, id)).returning().get();
}

export function reorderGroups(db: Database, orderedIds: readonly number[]): void {
  writeOrder(db, activityGroups, orderedIds);
}
