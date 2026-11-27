import type { TFunction } from 'i18next';

import { formatNumeric } from '@/lib/dates';
import type { ImportPlan } from '@/lib/daylio/plan';
import { experimentKey } from '@/lib/experiments/rules';

import type { ImportSummary } from './import';

type ExperimentIdentity = { title: string; start_date: string };

/**
 * Stored experiments a replace deletes: every one the file does not bring again (same folded title,
 * same start). A CSV and a backup without experiments bring none, so all of them go.
 */
export function experimentsLost(stored: readonly ExperimentIdentity[], incoming: readonly ExperimentIdentity[]): number {
  const keys = new Set(incoming.map(experimentKey));
  return stored.filter((experiment) => !keys.has(experimentKey(experiment))).length;
}

/** A CSV import plan in the same shape as a JSON preview. A CSV never holds experiments, so a replace loses every stored one. */
export function summarizePlan(plan: ImportPlan, storedExperiments: readonly ExperimentIdentity[] = []): ImportSummary {
  return {
    entries: plan.entryCount,
    from: plan.from,
    to: plan.to,
    moods: plan.moods.length,
    newMoods: plan.moods.filter((mood) => mood.existingId === null).length,
    activities: plan.activities.length,
    newActivities: plan.activities.filter((activity) => activity.existingId === null).length,
    toAdd: plan.entries.length,
    duplicates: plan.duplicates,
    photos: plan.photos,
    newPhotos: plan.newPhotos,
    healthDays: 0,
    experiments: 0,
    experimentsLost: experimentsLost(storedExperiments, []),
  };
}

/**
 * "120 Einträge vom 01.03.2026 bis 28.06.2026, 5 Stimmungen, 30 Aktivitäten (davon 12 neu).
 * Zusammenführen fügt 120 Einträge hinzu, 0 sind schon vorhanden."
 */
export function summaryText(t: TFunction, summary: ImportSummary): string {
  if (!summary.from || !summary.to) return t('import.summaryEmpty');
  const contents = t('import.summary', {
    entries: t('import.entries', { count: summary.entries }),
    from: formatNumeric(summary.from),
    to: formatNumeric(summary.to),
    moods: t('import.moods', { count: summary.moods }),
    activities: t('import.activities', { count: summary.activities }),
    fresh: summary.newActivities,
  });
  const merge = t('import.mergeInfo', { count: summary.toAdd, duplicates: t('import.duplicates', { count: summary.duplicates }) });
  const photos = summary.photos > 0 ? ` ${t('import.photoInfo', { count: summary.photos, fresh: summary.newPhotos })}` : '';
  const health = summary.healthDays > 0 ? ` ${t('import.healthInfo', { count: summary.healthDays })}` : '';
  const experiments = summary.experiments > 0 ? ` ${t('experiments.import.inFile', { count: summary.experiments })}` : '';
  return `${contents} ${merge}${photos}${health}${experiments}`;
}
