import { defaultGroups, defaultMoods } from '@/lib/daylio/known';
import { currentLanguage, type Language } from '@/lib/i18n/language';

import { activityGroups, moods } from '../schema';
import type { Database } from '../types';
import { ensureSettings } from './settings';

/**
 * First start (and after "delete all"): the settings row, the five standard moods and the standard
 * activity groups, named in `language`. Only fills empty tables, so it is safe to call on every start.
 */
export function ensureDefaults(db: Database, language: Language = currentLanguage()): void {
  ensureSettings(db);
  if (!db.select({ id: moods.id }).from(moods).limit(1).get()) {
    db.insert(moods)
      .values(defaultMoods(language).map((mood, index) => ({ ...mood, sort_order: index })))
      .run();
  }
  if (!db.select({ id: activityGroups.id }).from(activityGroups).limit(1).get()) {
    db.insert(activityGroups)
      .values(defaultGroups(language).map((name, index) => ({ name, sort_order: index })))
      .run();
  }
}
