import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { withLockSuspended } from '@/lib/lock/store';

/** Native side of export/import. Everything stays on the device unless the user shares. */

/** No app on the device takes a share; screens show `common.shareUnavailable` for it. */
export class ShareUnavailableError extends Error {
  constructor() {
    super('Sharing is not available on this device');
    this.name = 'ShareUnavailableError';
  }
}

function cacheFile(name: string): File {
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  return file;
}

export async function shareText(name: string, mimeType: string, content: string): Promise<void> {
  const file = cacheFile(name);
  file.write(content);
  if (!(await Sharing.isAvailableAsync())) throw new ShareUnavailableError();
  await withLockSuspended(() => Sharing.shareAsync(file.uri, { mimeType, dialogTitle: name }));
}

/** Storage Access Framework: the user picks a folder (e.g. Downloads); returns false when cancelled. */
export async function saveToPickedDirectory(name: string, mimeType: string, content: string): Promise<boolean> {
  let directory: Directory;
  try {
    directory = await withLockSuspended(() => Directory.pickDirectoryAsync());
  } catch {
    return false;
  }
  const file = directory.createFile(name, mimeType);
  file.write(content);
  return true;
}

/** Like `shareText`, for binary content handed over as base64 (a rendered PNG). */
export async function shareBase64(name: string, mimeType: string, base64: string): Promise<void> {
  const file = cacheFile(name);
  file.write(base64, { encoding: 'base64' });
  if (!(await Sharing.isAvailableAsync())) throw new ShareUnavailableError();
  await withLockSuspended(() => Sharing.shareAsync(file.uri, { mimeType, dialogTitle: name }));
}

/** Like `saveToPickedDirectory`, for binary content handed over as base64 (a rendered PNG). */
export async function saveBase64ToPickedDirectory(name: string, mimeType: string, base64: string): Promise<boolean> {
  let directory: Directory;
  try {
    directory = await withLockSuspended(() => Directory.pickDirectoryAsync());
  } catch {
    return false;
  }
  directory.createFile(name, mimeType).write(base64, { encoding: 'base64' });
  return true;
}

/**
 * Writes a file in chunks into the cache, gathering them so the disk sees few large appends
 * instead of thousands of small ones. `fill` gets the write function and runs synchronously.
 */
function cacheFileFrom(name: string, fill: (write: (chunk: Uint8Array) => void) => void): File {
  const file = cacheFile(name);
  const LIMIT = 4 * 1024 * 1024;
  let pending: Uint8Array[] = [];
  let size = 0;
  let started = false;
  const flush = () => {
    if (size === 0) return;
    const joined = new Uint8Array(size);
    let offset = 0;
    for (const chunk of pending) {
      joined.set(chunk, offset);
      offset += chunk.length;
    }
    file.write(joined, { append: started });
    started = true;
    pending = [];
    size = 0;
  };
  fill((chunk) => {
    pending.push(chunk);
    size += chunk.length;
    if (size >= LIMIT) flush();
  });
  flush();
  return file;
}

export async function shareBinary(name: string, mimeType: string, fill: (write: (chunk: Uint8Array) => void) => void): Promise<void> {
  const file = cacheFileFrom(name, fill);
  if (!(await Sharing.isAvailableAsync())) throw new ShareUnavailableError();
  await withLockSuspended(() => Sharing.shareAsync(file.uri, { mimeType, dialogTitle: name }));
}

/** Like `saveToPickedDirectory`, for a file built in chunks (the backup ZIP). */
export async function saveBinaryToPickedDirectory(name: string, mimeType: string, fill: (write: (chunk: Uint8Array) => void) => void): Promise<boolean> {
  let directory: Directory;
  try {
    directory = await withLockSuspended(() => Directory.pickDirectoryAsync());
  } catch {
    return false;
  }
  const built = cacheFileFrom(name, fill);
  // A folder picked through Android's storage access can only be written as a whole.
  directory.createFile(name, mimeType).write(built.bytesSync());
  built.delete();
  return true;
}

/** Lets the user pick a file to import and returns its name and bytes, or null when cancelled. */
export async function pickImportFile(): Promise<{ name: string; bytes: Uint8Array } | null> {
  const result = await withLockSuspended(() =>
    DocumentPicker.getDocumentAsync({
      type: ['application/json', 'text/csv', 'text/comma-separated-values', 'text/plain', 'application/zip', 'application/octet-stream', '*/*'],
      copyToCacheDirectory: true,
      multiple: false,
    }),
  );
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset) return null;
  const file = new File(asset.uri);
  const bytes = await file.bytes();
  // The picker's cache copy holds a whole journal; it is read now and not needed again.
  if (file.exists) file.delete();
  return { name: asset.name, bytes };
}

/**
 * Deletes a file another module left behind (the PDF `expo-print` writes to `cache/Print/`) once
 * its content is read. Never throws: the cache is cleared on "Alle Daten löschen" anyway.
 */
export function discardFile(uri: string): void {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Gone already, or not ours to delete; "Alle Daten löschen" clears the folder.
  }
}

/** Cache folders where the pickers, the image manipulator and the PDF printer leave copies of what passed through. */
const COPY_FOLDERS = ['ImagePicker', 'ImageManipulator', 'DocumentPicker', 'Print'];

/**
 * "Alle Daten löschen": the exports shared from the cache (`daylight-…`) and the copies the pickers
 * left there go too, so no journal or photo survives outside the database and the photo folder.
 */
export function deleteCachedCopies(): void {
  for (const item of Paths.cache.list()) {
    const ours = item instanceof File ? item.name.startsWith('daylight-') : COPY_FOLDERS.includes(item.name);
    if (!ours) continue;
    try {
      item.delete();
    } catch {
      // Android clears the cache on its own sooner or later; one stuck file must not stop the rest.
    }
  }
}
