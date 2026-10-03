import { defaultGroups, defaultMoods, starterActivities } from '@/lib/daylio/known';
import { currentLanguage, type Language } from '@/lib/i18n/language';

import { activities, activityGroups, moods } from '../schema';
import type { Database } from '../types';
import { ensureSettings } from './settings';

/**
 * First start (and after "delete all"): the settings row, the five standard moods and the standard
 * activity groups with a few starter activities each, named in `language`. Only fills empty tables,
 * so it is safe to call on every start. The starter activities come only together with fresh groups,
 * so an emptied group stays empty; `starters: false` leaves them out, for an import that brings its own.
 */
export function ensureDefaults(db: Database, language: Language = currentLanguage(), options: { starters?: boolean } = {}): void {
  ensureSettings(db);
  if (!db.select({ id: moods.id }).from(moods).limit(1).get()) {
    db.insert(moods)
      .values(defaultMoods(language).map((mood, index) => ({ ...mood, sort_order: index })))
      .run();
  }
  if (!db.select({ id: activityGroups.id }).from(activityGroups).limit(1).get()) {
    const groups = db
      .insert(activityGroups)
      .values(defaultGroups(language).map((name, index) => ({ name, sort_order: index })))
      .returning({ id: activityGroups.id })
      .all();
    if (options.starters === false) return;
    const rows = starterActivities(language).flatMap((starters, group) =>
      starters.map((activity, index) => ({ ...activity, group_id: groups[group]!.id, sort_order: index })),
    );
    db.insert(activities).values(rows).run();
  }
}
