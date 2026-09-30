import { useMemo } from 'react';

import { getDb } from '@/db';
import { listGroups } from '@/db/repositories/groups';
import { readCatalog } from '@/lib/daylio/apply';
import { resolveGroupName } from '@/lib/daylio/known';
import type { RowError, RowWarning } from '@/lib/daylio/parse';
import { buildImportPlan, type ImportChoices, type PlannedActivity, type PlannedMood } from '@/lib/daylio/plan';
import { useQuery } from '@/lib/store/dataVersion';

import { previewImport, type ImportSummary } from './import';
import type { PendingImport } from './pending';
import { summarizePlan } from './summary';

export interface ImportPreview {
  summary: ImportSummary;
  /** CSV only: moods and activities the import would create, for the mapping step. */
  newMoods: PlannedMood[];
  newActivities: PlannedActivity[];
  /** Groups a new activity can be put into. */
  groupNames: string[];
  errors: RowError[];
  warnings: RowWarning[];
}

/** Recomputes the preview whenever the file, the choices or the database change. Never writes. */
export function useImportPreview(file: PendingImport | null, choices: ImportChoices): ImportPreview | null {
  const catalog = useQuery(() => readCatalog(getDb()), []);
  const groups = useQuery(() => listGroups(getDb()).map((group) => group.name), []);
  const json = useQuery(() => (file?.kind === 'json' ? previewImport(getDb(), file.payload, { files: file.photos }) : null), [file]);

  return useMemo(() => {
    if (!file) return null;
    const imported = resolveGroupName('imported', groups);
    const groupNames = groups.includes(imported) ? groups : [...groups, imported];
    if (file.kind === 'json') {
      return json ? { summary: json, newMoods: [], newActivities: [], groupNames, errors: [], warnings: [] } : null;
    }
    const plan = buildImportPlan(file.parsed.entries, catalog, choices);
    return {
      summary: summarizePlan(plan),
      newMoods: plan.moods.filter((mood) => mood.existingId === null),
      newActivities: plan.activities.filter((activity) => activity.existingId === null),
      groupNames,
      errors: file.parsed.errors,
      warnings: file.parsed.warnings,
    };
  }, [file, choices, catalog, groups, json]);
}
