import { listActivities } from '@/db/repositories/activities';
import { setPlannedActivities } from '@/db/repositories/plans';
import { createScale } from '@/db/repositories/scales';
import type { Database } from '@/db/types';
import { today } from '@/lib/dates';
import { applyDaylioImport } from '@/lib/daylio/apply';
import { currentLanguage, type Language } from '@/lib/i18n/language';
import { fold } from '@/lib/search/fold';

import { sampleInEnglish, SAMPLE_SCALE_EN } from './english';
import { generateSample, SAMPLE_SCALE, type SampleData } from './generateSample';

/**
 * Loads sample data through the same path as a Daylio import, so it lands exactly as real data
 * would. Meant for an empty database; it never clears anything itself.
 */
export function applySample(db: Database, data: SampleData, language: Language = 'de'): void {
  db.transaction((tx) => {
    createScale(tx, language === 'en' ? SAMPLE_SCALE_EN : SAMPLE_SCALE);
    applyDaylioImport(tx, { entries: data.entries, errors: [], warnings: [] }, { mode: 'merge', source: 'app' });
    const ids = new Map(listActivities(tx).map((activity) => [fold(activity.name), activity.id]));
    const byDate = new Map<string, number[]>();
    for (const plan of data.plans) {
      const id = ids.get(fold(plan.activity));
      if (id !== undefined) byDate.set(plan.date, [...(byDate.get(plan.date) ?? []), id]);
    }
    for (const [date, activityIds] of byDate) setPlannedActivities(tx, date, activityIds);
  });
}

/** In the app's language: English names and notes on an English device, German otherwise. */
export function loadSampleData(db: Database, seed = 42, language: Language = currentLanguage()): SampleData {
  const german = generateSample({ seed, today: today() });
  const data = language === 'en' ? sampleInEnglish(german) : german;
  applySample(db, data, language);
  return data;
}
