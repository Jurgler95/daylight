import { useMemo } from 'react';

import { getDb } from '@/db';
import { listGroups } from '@/db/repositories/groups';
import { readCatalog, type ImportMode } from '@/lib/daylio/apply';
import { resolveGroupName } from '@/lib/daylio/known';
import type { RowError, RowWarning } from '@/lib/daylio/parse';
import { buildImportPlan, defaultsCatalog, type ImportChoices, type PlannedActivity, type PlannedMood } from '@/lib/daylio/plan';
import { filePhotoStore } from '@/lib/photos/fileStore';
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

/**
 * Recomputes the preview whenever the file, the choices, the mode or the database change. Never writes.
 * A CSV replace plans against the standard moods and groups it starts from, so the mapping asks about
 * every mood and activity the clearing removes.
 */
export function useImportPreview(file: PendingImport | null, choices: ImportChoices, mode: ImportMode = 'merge'): ImportPreview | null {
  const stored = useQuery(() => readCatalog(getDb()), []);
  const storedGroups = useQuery(() => listGroups(getDb()).map((group) => group.name), []);
  const json = useQuery(() => (file?.kind === 'json' ? previewImport(getDb(), file.payload, { store: filePhotoStore, files: file.photos }) : null), [file]);

  return useMemo(() => {
    if (!file) return null;
    const fresh = mode === 'replace' && file.kind === 'csv';
    const catalog = fresh ? defaultsCatalog() : stored;
    const groups = fresh ? catalog.groups.map((group) => group.name) : storedGroups;
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
  }, [file, choices, mode, stored, storedGroups, json]);
}
