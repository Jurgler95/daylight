import { createActivity, listActivities } from '@/db/repositories/activities';
import { ensureDefaults } from '@/db/repositories/defaults';
import { createEntry, listEntryDetails } from '@/db/repositories/entries';
import { createGroup, listGroups } from '@/db/repositories/groups';
import { clearJournal } from '@/db/repositories/maintenance';
import { createMood, listMoods } from '@/db/repositories/moods';
import { addPhotos, allPhotoFileNames } from '@/db/repositories/photos';
import { createScale, listScales } from '@/db/repositories/scales';
import type { EntrySource } from '@/db/schema';
import type { Database } from '@/db/types';
import { sweepPhotos, writePhotos, type PhotoStore } from '@/lib/photos/store';
import { fold } from '@/lib/search/fold';

import type { ParsedDaylio, RawEntry } from './parse';
import { buildImportPlan, entryKey, type Catalog, type ImportChoices, type ImportPlan } from './plan';

/** Database side of the CSV import: read what is there, carry out a plan. */

export type ImportMode = 'merge' | 'replace';

export class ImportHasErrorsError extends Error {
  override readonly name = 'ImportHasErrorsError';
  constructor(readonly count: number) {
    super(`${count} fehlerhafte Zeilen, Überspringen nicht bestätigt`);
  }
}

export function readCatalog(db: Database): Catalog {
  return {
    moods: listMoods(db, { includeArchived: true }),
    groups: listGroups(db, { includeArchived: true }),
    activities: listActivities(db, { includeArchived: true }),
    scales: listScales(db, { includeArchived: true }),
    entryKeys: new Set(listEntryDetails(db).map((entry) => entryKey(entry.date, entry.time, entry.level, entry.note))),
    photoNames: allPhotoFileNames(db),
  };
}

/** What a merge would do, computed against the current database. Never writes. */
export function previewDaylioImport(db: Database, parsed: ParsedDaylio, choices: ImportChoices = {}): ImportPlan {
  return buildImportPlan(parsed.entries, readCatalog(db), choices);
}

/** Creates everything the plan needs, then the entries. Expects to run inside a transaction. */
function carryOut(tx: Database, plan: ImportPlan, source: EntrySource): number {
  const moodIds = new Map<string, number>();
  for (const mood of plan.moods) {
    moodIds.set(mood.key, mood.existingId ?? createMood(tx, { label: mood.label, level: mood.level }).id);
  }

  const groupIds = new Map(listGroups(tx, { includeArchived: true }).map((group) => [fold(group.name), group.id]));
  for (const name of plan.newGroups) groupIds.set(fold(name), createGroup(tx, name).id);

  // New activities keep the order the file implies, behind what their group already holds.
  const activityIds = new Map<string, number>();
  for (const activity of [...plan.activities].sort((a, b) => a.rank - b.rank)) {
    if (activity.existingId !== null) {
      activityIds.set(activity.key, activity.existingId);
      continue;
    }
    const groupId = groupIds.get(fold(activity.group)) ?? createGroup(tx, activity.group).id;
    groupIds.set(fold(activity.group), groupId);
    activityIds.set(activity.key, createActivity(tx, { group_id: groupId, name: activity.name, icon: activity.icon }).id);
  }

  const scaleIds = new Map(listScales(tx, { includeArchived: true }).map((scale) => [fold(scale.name), scale.id]));
  for (const scale of plan.newScales) scaleIds.set(fold(scale.name), createScale(tx, scale).id);

  for (const { raw } of plan.entries) {
    const moodId = moodIds.get(fold(raw.mood));
    if (moodId === undefined) throw new Error(`Stimmung ohne Zuordnung: ${raw.mood}`);
    createEntry(tx, {
      date: raw.date,
      time: raw.time,
      mood_id: moodId,
      note_title: raw.noteTitle,
      note: raw.note,
      source,
      activity_ids: raw.activities.map((name) => activityIds.get(fold(name))).filter((id): id is number => id !== undefined),
      scales: raw.scales.flatMap((scale) => {
        const id = scaleIds.get(fold(scale.name));
        return id === undefined ? [] : [{ scale_id: id, value: scale.value }];
      }),
    });
  }
  return plan.entries.length;
}

/**
 * Hangs every record's photos on the entry it matches, new or already stored, so a Daylio backup
 * also brings the photos of entries that came in earlier through the CSV. Returns how many were added.
 */
function attachPhotos(tx: Database, plan: ImportPlan, records: readonly RawEntry[]): number {
  const withPhotos = records.filter((record) => record.photos.length > 0);
  if (withPhotos.length === 0) return 0;
  const levels = new Map(plan.moods.map((mood) => [mood.key, mood.level]));
  const ids = new Map<string, number>();
  for (const entry of listEntryDetails(tx)) {
    const key = entryKey(entry.date, entry.time, entry.level, entry.note);
    if (!ids.has(key)) ids.set(key, entry.id);
  }
  let added = 0;
  for (const record of withPhotos) {
    const id = ids.get(entryKey(record.date, record.time, levels.get(fold(record.mood)) ?? 0, record.note));
    if (id !== undefined) added += addPhotos(tx, id, record.photos).length;
  }
  return added;
}

export interface ImportOutcome {
  added: number;
  duplicates: number;
  skipped: number;
  photos: number;
}

/**
 * Applies a parsed Daylio file in one transaction. Rows with errors are only skipped when
 * `skipErrors` confirms it; otherwise nothing is written. `replace` clears the journal first
 * (settings stay) and plans against a fresh start, so the preview's merge numbers do not apply.
 */
export function applyDaylioImport(
  db: Database,
  parsed: ParsedDaylio,
  /** Without `store`, photos in the file are left out. */
  options: { mode: ImportMode; choices?: ImportChoices; skipErrors?: boolean; source?: EntrySource; store?: PhotoStore },
): ImportOutcome {
  if (parsed.errors.length > 0 && !options.skipErrors) throw new ImportHasErrorsError(parsed.errors.length);
  const files = parsed.photoFiles;
  const { store } = options;
  // Files first, so no row ever points to a missing file; whatever ends up unused is swept below.
  if (store && files) writePhotos(store, files, new Set(parsed.entries.flatMap((record) => record.photos)));
  try {
    return db.transaction((tx) => {
      if (options.mode === 'replace') {
        clearJournal(tx);
        ensureDefaults(tx);
      }
      const plan = buildImportPlan(parsed.entries, readCatalog(tx), options.choices);
      const added = carryOut(tx, plan, options.source ?? 'daylio_csv');
      const photos = store ? attachPhotos(tx, plan, parsed.entries) : 0;
      return { added, duplicates: plan.duplicates, skipped: parsed.errors.length, photos };
    });
  } finally {
    if (store) sweepPhotos(db, store);
  }
}
