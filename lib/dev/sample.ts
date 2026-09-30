import { listActivities } from '@/db/repositories/activities';
import { setPlannedActivities } from '@/db/repositories/plans';
import { createScale } from '@/db/repositories/scales';
import type { Database } from '@/db/types';
import { today } from '@/lib/dates';
import { applyDaylioImport } from '@/lib/daylio/apply';
import { fold } from '@/lib/search/fold';

import { generateSample, SAMPLE_SCALE, type SampleData } from './generateSample';

/**
 * Loads sample data through the same path as a Daylio import, so it lands exactly as real data
 * would. Meant for an empty database; it never clears anything itself.
 */
export function applySample(db: Database, data: SampleData): void {
  db.transaction((tx) => {
    createScale(tx, SAMPLE_SCALE);
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

export function loadSampleData(db: Database, seed = 42): SampleData {
  const data = generateSample({ seed, today: today() });
  applySample(db, data);
  return data;
}
