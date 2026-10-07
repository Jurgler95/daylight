import { chunked } from '@/db/chunks';
import { ensureDefaults } from '@/db/repositories/defaults';
import { restoreHealthDays } from '@/db/repositories/health';
import { updateSettings } from '@/db/repositories/settings';
import { clearJournal } from '@/db/repositories/maintenance';
import { allPhotoFileNames } from '@/db/repositories/photos';
import { activities, activityGroups, entries, entryActivities, entryPhotos, entryScales, moods, plannedActivities, scales, settings, turningPoints } from '@/db/schema';
import type { Database } from '@/db/types';
import type { DateString } from '@/lib/dates';
import type { ImportMode } from '@/lib/daylio/apply';
import { sweepPhotos, writePhotos, type PhotoStore } from '@/lib/photos/store';
import { onEntryDays } from '@/lib/turning/rules';

import { matchPayload, mergeImport } from './merge';
import { migrateExportFormat } from './migrateFormat';
import { exportSchema, type ExportPayload } from './schema';

/** What the preview says about a file, the same shape for JSON and CSV. */
export interface ImportSummary {
  entries: number;
  from: DateString | null;
  to: DateString | null;
  moods: number;
  newMoods: number;
  activities: number;
  newActivities: number;
  /** What a merge would add and how many entries are already there. */
  toAdd: number;
  duplicates: number;
  /** Photos the file brings, and how many of them are not stored yet. */
  photos: number;
  newPhotos: number;
  /** Days with health data in the file (only when it was saved with them). */
  healthDays: number;
}

/** Photo files that came with a backup (ZIP), and where they go. */
export interface PhotoTransfer {
  store?: PhotoStore;
  files?: ReadonlyMap<string, Uint8Array>;
}

/** Photo rows whose file is actually there, in the ZIP or already on the device; the rest is dropped. */
function usablePhotos(payload: ExportPayload, photos: PhotoTransfer): ExportPayload['entry_photos'] {
  return payload.entry_photos.filter((photo) => photos.files?.has(photo.file_name) || photos.store?.has(photo.file_name));
}

/** Parses and validates text. Throws ImportFormatError, SyntaxError or ZodError; never touches the database. */
export function parseImport(text: string): ExportPayload {
  return exportSchema.parse(migrateExportFormat(JSON.parse(text)));
}

export function previewImport(db: Database, payload: ExportPayload, photos: PhotoTransfer = {}): ImportSummary {
  const matches = matchPayload(db, payload);
  const stored = allPhotoFileNames(db);
  const usable = usablePhotos(payload, photos);
  const dates = payload.entries.map((entry) => entry.date).sort();
  const isNew = (found: Map<number, number | null>) => [...found.values()].filter((id) => id === null).length;
  return {
    entries: payload.entries.length,
    from: (dates[0] as DateString | undefined) ?? null,
    to: (dates[dates.length - 1] as DateString | undefined) ?? null,
    moods: payload.moods.length,
    newMoods: isNew(matches.moods),
    activities: payload.activities.length,
    newActivities: isNew(matches.activities),
    toAdd: matches.newEntries.length,
    duplicates: matches.duplicates,
    photos: usable.length,
    newPhotos: usable.filter((photo) => !stored.has(photo.file_name)).length,
    healthDays: payload.health_days?.length ?? 0,
  };
}

/**
 * Applies the payload in one transaction; any failure rolls everything back. Photo files are written
 * before, and files nothing points to any more are removed after (also when it failed).
 */
export function applyImport(db: Database, payload: ExportPayload, mode: ImportMode, photos: PhotoTransfer = {}): { added: number; duplicates: number } {
  const usable = { ...payload, entry_photos: photos.store ? usablePhotos(payload, photos) : [] };
  const { store, files } = photos;
  if (store && files) writePhotos(store, files, usable.entry_photos.map((photo) => photo.file_name));
  try {
    return db.transaction((tx) => {
      const result = mode === 'replace' ? replaceAll(tx, usable) : mergeImport(tx, usable);
      restoreHealth(tx, payload);
      return result;
    });
  } finally {
    if (store) sweepPhotos(db, store);
  }
}

/**
 * Health days from the backup fill the days this device has nothing for, in both modes: they are not
 * part of the journal, and a replace leaves the ones already here. A backup with health days turns
 * the opt-in on, so the next backup keeps them.
 */
function restoreHealth(tx: Database, payload: ExportPayload): void {
  if (!payload.health_days?.length) return;
  restoreHealthDays(tx, payload.health_days);
  updateSettings(tx, { health_in_backup: true });
}

/** Restores the snapshot 1:1, ids included. The device-local `last_export_at` survives. */
function replaceAll(tx: Database, payload: ExportPayload): { added: number; duplicates: number } {
  clearJournal(tx);
  tx.update(settings).set(payload.settings).run();
  const insert = <T>(rows: T[], write: (rows: T[]) => void) => {
    for (const chunk of chunked(rows)) write(chunk);
  };
  insert(payload.moods, (rows) => tx.insert(moods).values(rows).run());
  insert(payload.activity_groups, (rows) => tx.insert(activityGroups).values(rows).run());
  insert(payload.activities, (rows) => tx.insert(activities).values(rows).run());
  insert(payload.scales, (rows) => tx.insert(scales).values(rows).run());
  insert(payload.entries, (rows) => tx.insert(entries).values(rows).run());
  insert(payload.entry_activities, (rows) => tx.insert(entryActivities).values(rows).run());
  insert(payload.entry_scales, (rows) => tx.insert(entryScales).values(rows).run());
  insert(payload.planned_activities, (rows) => tx.insert(plannedActivities).values(rows).run());
  insert(payload.entry_photos, (rows) => tx.insert(entryPhotos).values(rows).run());
  insert(onEntryDays(payload.turning_points ?? [], payload.entries), (rows) => tx.insert(turningPoints).values(rows).run());
  ensureDefaults(tx);
  return { added: payload.entries.length, duplicates: 0 };
}
