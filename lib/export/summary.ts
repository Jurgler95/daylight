import type { TFunction } from 'i18next';

import { formatNumeric } from '@/lib/dates';
import type { ImportPlan } from '@/lib/daylio/plan';

import type { ImportSummary } from './import';

/** A CSV import plan in the same shape as a JSON preview. */
export function summarizePlan(plan: ImportPlan): ImportSummary {
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
  return `${contents} ${merge}${photos}${health}`;
}
