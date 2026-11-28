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
    created: {
      moods: plan.moods.filter((mood) => mood.existingId === null).map((mood) => mood.label),
      groups: plan.newGroups,
      activities: plan.activities.filter((activity) => activity.existingId === null).map((activity) => activity.name),
    },
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

/** Names shown before "und 3 weitere". */
const CREATED_SHOWN = 5;

/**
 * "Neue Stimmungen: Prima. Neue Aktivitäten: Yoga, Malen und 3 weitere." Null when a merge creates
 * nothing, so a backup from the same journal or one in another language says nothing extra.
 */
export function createdText(t: TFunction, created: ImportSummary['created']): string | null {
  const parts = (
    [
      ['import.newMoods', created.moods],
      ['import.newGroups', created.groups],
      ['import.newActivities', created.activities],
    ] as const
  ).flatMap(([title, names]) => {
    if (names.length === 0) return [];
    const shown = names.slice(0, CREATED_SHOWN).join(', ');
    const rest = names.length - CREATED_SHOWN;
    return [t('import.newList', { title: t(title), names: rest > 0 ? `${shown} ${t('import.more', { count: rest })}` : shown })];
  });
  return parts.length > 0 ? parts.join(' ') : null;
}
