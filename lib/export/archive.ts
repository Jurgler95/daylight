import { strFromU8, strToU8, Zip, ZipDeflate, ZipPassThrough } from 'fflate';

import type { PhotoStore } from '@/lib/photos/store';

import { parseImport } from './import';
import type { ExportPayload } from './schema';

/**
 * A backup with photos is a ZIP: the JSON as `daylight.json`, every photo under `photos/`. Without
 * photos the backup stays a plain JSON file, as it always was.
 */

export const ARCHIVE_JSON = 'daylight.json';
export const ARCHIVE_PHOTOS = 'photos/';

export class BackupArchiveError extends Error {
  override readonly name = 'BackupArchiveError';
}

export function isBackupArchive(files: ReadonlyMap<string, Uint8Array>): boolean {
  return files.has(ARCHIVE_JSON);
}

/** The JSON validated as always, plus the photo bytes by file name. */
export function readBackupArchive(files: ReadonlyMap<string, Uint8Array>): { payload: ExportPayload; photos: Map<string, Uint8Array> } {
  const json = files.get(ARCHIVE_JSON);
  if (!json) throw new BackupArchiveError(`${ARCHIVE_JSON} fehlt`);
  const photos = new Map<string, Uint8Array>();
  for (const [name, bytes] of files) {
    if (name.startsWith(ARCHIVE_PHOTOS) && name.length > ARCHIVE_PHOTOS.length) photos.set(name.slice(ARCHIVE_PHOTOS.length), bytes);
  }
  return { payload: parseImport(strFromU8(json)), photos };
}

/**
 * Streams the archive to `write` in chunks, one photo in memory at a time. Photos are stored as they
 * are (JPEG does not shrink further), the JSON is compressed.
 */
export function writeBackupArchive(payload: ExportPayload, store: PhotoStore, write: (chunk: Uint8Array) => void): void {
  let failure: Error | null = null;
  const zip = new Zip((error, chunk) => {
    if (error) failure = error;
    else write(chunk);
  });
  const json = new ZipDeflate(ARCHIVE_JSON, { level: 6 });
  zip.add(json);
  json.push(strToU8(JSON.stringify(payload, null, 2)), true);
  for (const photo of payload.entry_photos) {
    if (!store.has(photo.file_name)) continue;
    const file = new ZipPassThrough(ARCHIVE_PHOTOS + photo.file_name);
    zip.add(file);
    file.push(store.read(photo.file_name), true);
  }
  zip.end();
  if (failure) throw failure;
}

export function archiveFileName(date: string): string {
  return `daylight-export-${date}.zip`;
}
