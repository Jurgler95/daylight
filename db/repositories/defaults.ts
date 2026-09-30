import { DEFAULT_GROUPS, DEFAULT_MOODS } from '@/lib/daylio/known';

import { activityGroups, moods } from '../schema';
import type { Database } from '../types';
import { ensureSettings } from './settings';

/**
 * First start (and after "delete all"): the settings row, the five standard moods and the standard
 * activity groups. Only fills empty tables, so it is safe to call on every start.
 */
export function ensureDefaults(db: Database): void {
  ensureSettings(db);
  if (!db.select({ id: moods.id }).from(moods).limit(1).get()) {
    db.insert(moods)
      .values(DEFAULT_MOODS.map((mood, index) => ({ ...mood, sort_order: index })))
      .run();
  }
  if (!db.select({ id: activityGroups.id }).from(activityGroups).limit(1).get()) {
    db.insert(activityGroups)
      .values(DEFAULT_GROUPS.map((name, index) => ({ name, sort_order: index })))
      .run();
  }
}
