import { and, asc, eq, gte, lte } from 'drizzle-orm';

import { plannedActivities, type PlannedActivity } from '../schema';
import type { Database } from '../types';
import { assertDate } from '../validate';

/** Replaces what is planned for one day. */
export function setPlannedActivities(db: Database, date: string, activityIds: readonly number[]): void {
  const day = assertDate(date);
  db.transaction((tx) => {
    tx.delete(plannedActivities).where(eq(plannedActivities.date, day)).run();
    const unique = [...new Set(activityIds)];
    if (unique.length) tx.insert(plannedActivities).values(unique.map((activity_id) => ({ date: day, activity_id }))).run();
  });
}

export function listPlannedActivities(db: Database, from?: string, to?: string): PlannedActivity[] {
  return db
    .select()
    .from(plannedActivities)
    .where(and(from ? gte(plannedActivities.date, from) : undefined, to ? lte(plannedActivities.date, to) : undefined))
    .orderBy(asc(plannedActivities.date), asc(plannedActivities.activity_id))
    .all();
}
