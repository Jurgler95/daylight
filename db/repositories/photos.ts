import { asc, eq, inArray } from 'drizzle-orm';

import { entryPhotos } from '../schema';
import type { Database } from '../types';

/**
 * Rows of `entry_photos`. The files themselves are handled by `lib/photos`; these functions never
 * touch the disk, so callers delete files only after the rows are gone.
 */

/** File names of one entry's photos, in display order. */
export function listPhotos(db: Database, entryId: number): string[] {
  return db
    .select({ file_name: entryPhotos.file_name })
    .from(entryPhotos)
    .where(eq(entryPhotos.entry_id, entryId))
    .orderBy(asc(entryPhotos.sort_order), asc(entryPhotos.id))
    .all()
    .map((row) => row.file_name);
}

/** Every entry's photo file names in display order, keyed by entry id. */
export function photosByEntry(db: Database): Map<number, string[]> {
  const result = new Map<number, string[]>();
  const rows = db.select().from(entryPhotos).orderBy(asc(entryPhotos.entry_id), asc(entryPhotos.sort_order), asc(entryPhotos.id)).all();
  for (const row of rows) {
    const list = result.get(row.entry_id);
    if (list) list.push(row.file_name);
    else result.set(row.entry_id, [row.file_name]);
  }
  return result;
}

/** Photo file names of the given entries in display order, keyed by entry id; entries without photos are missing. */
export function photosForEntries(db: Database, entryIds: readonly number[]): Map<number, string[]> {
  const result = new Map<number, string[]>();
  if (entryIds.length === 0) return result;
  const rows = db
    .select()
    .from(entryPhotos)
    .where(inArray(entryPhotos.entry_id, [...entryIds]))
    .orderBy(asc(entryPhotos.entry_id), asc(entryPhotos.sort_order), asc(entryPhotos.id))
    .all();
  for (const row of rows) {
    const list = result.get(row.entry_id);
    if (list) list.push(row.file_name);
    else result.set(row.entry_id, [row.file_name]);
  }
  return result;
}

/** Every file name the database points to, to tell which files on disk are left over. */
export function allPhotoFileNames(db: Database): Set<string> {
  return new Set(
    db
      .select({ file_name: entryPhotos.file_name })
      .from(entryPhotos)
      .all()
      .map((row) => row.file_name),
  );
}

/** Replaces the entry's photo list with `fileNames`, in that order. */
export function setPhotos(db: Database, entryId: number, fileNames: readonly string[]): void {
  db.delete(entryPhotos).where(eq(entryPhotos.entry_id, entryId)).run();
  const unique = [...new Set(fileNames)];
  if (unique.length) db.insert(entryPhotos).values(unique.map((file_name, sort_order) => ({ entry_id: entryId, file_name, sort_order }))).run();
}

/** Appends photos behind the ones the entry already has; names the database already knows are skipped. */
export function addPhotos(db: Database, entryId: number, fileNames: readonly string[]): string[] {
  const known = new Set(
    fileNames.length
      ? db
          .select({ file_name: entryPhotos.file_name })
          .from(entryPhotos)
          .where(inArray(entryPhotos.file_name, [...fileNames]))
          .all()
          .map((row) => row.file_name)
      : [],
  );
  const added = [...new Set(fileNames)].filter((name) => !known.has(name));
  if (added.length === 0) return [];
  const start = listPhotos(db, entryId).length;
  db.insert(entryPhotos)
    .values(added.map((file_name, i) => ({ entry_id: entryId, file_name, sort_order: start + i })))
    .run();
  return added;
}
