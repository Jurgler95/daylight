import { count } from 'drizzle-orm';

import { activities, activityGroups, entries, entryActivities, entryPhotos, entryScales, healthDays, moods, plannedActivities, scales, settings } from '../schema';
import type { Database } from '../types';
import { ensureDefaults } from './defaults';

/**
 * Removes every journal row (entries, moods, groups, activities, scales, plans) but keeps the
 * settings row. Does not restore the defaults: a replace-import brings its own moods and groups.
 * Photo files stay on disk; `sweepPhotos` removes them once nothing points to them.
 */
export function clearJournal(db: Database): void {
  db.delete(entryActivities).run();
  db.delete(entryPhotos).run();
  db.delete(entryScales).run();
  db.delete(plannedActivities).run();
  db.delete(entries).run();
  db.delete(activities).run();
  db.delete(activityGroups).run();
  db.delete(scales).run();
  db.delete(moods).run();
}

/**
 * Removes everything in one transaction, then restores the defaults of a first start. The health
 * days go too, and with the settings row the sync is off again. Permissions granted in Health
 * Connect stay until they are taken back there.
 */
export function deleteAllData(db: Database): void {
  db.transaction((tx) => {
    clearJournal(tx);
    tx.delete(healthDays).run();
    tx.delete(settings).run();
    ensureDefaults(tx);
  });
}

export interface DataCounts {
  entries: number;
  moods: number;
  groups: number;
  activities: number;
  scales: number;
  planned: number;
  photos: number;
}

export function countRows(db: Database): DataCounts {
  const n = (table: Parameters<ReturnType<Database['select']>['from']>[0]) => db.select({ n: count() }).from(table).get()?.n ?? 0;
  return {
    entries: n(entries),
    moods: n(moods),
    groups: n(activityGroups),
    activities: n(activities),
    scales: n(scales),
    planned: n(plannedActivities),
    photos: n(entryPhotos),
  };
}
