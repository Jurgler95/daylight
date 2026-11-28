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

/** The system folder picker could not be opened or failed; not a cancel. */
export class FolderPickerError extends Error {
  constructor(cause: unknown) {
    super(`Folder picker failed: ${describeCause(cause)}`);
    this.name = 'FolderPickerError';
  }
}

/** A folder was picked, but the file could not be written into it. */
export class FolderWriteError extends Error {
  constructor(cause: unknown) {
    super(`Writing to the picked folder failed: ${describeCause(cause)}`);
    this.name = 'FolderWriteError';
  }
}

/** The text an alert shows for a failed share or folder save, translated where the cause is known. */
export function exportErrorMessage(error: unknown, t: (key: string) => string): string {
  if (error instanceof ShareUnavailableError) return t('common.shareUnavailable');
  if (error instanceof FolderPickerError) return t('common.folderPickerFailed');
  if (error instanceof FolderWriteError) return t('common.folderWriteFailed');
  return error instanceof Error ? error.message.slice(0, 300) : String(error);
}

function describeCause(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

/** expo-file-system rejects a cancelled picker with this code (`PickerCancelledException`). */
const PICKER_CANCELLED = 'ERR_PICKER_CANCELLED';

function isPickerCancel(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === PICKER_CANCELLED;
}

/**
 * Storage Access Framework: the user picks a folder (e.g. Downloads). Returns null when cancelled.
 * Any other failure throws `FolderPickerError`, so the screen says so instead of doing nothing:
 * the picker once stayed shut after Android recreated the activity (plugins/withSyncHostDestroy.js).
 */
export async function pickDirectory(): Promise<Directory | null> {
  try {
    return await withLockSuspended(() => Directory.pickDirectoryAsync());
  } catch (error) {
    if (isPickerCancel(error)) return null;
    console.warn('Folder picker failed', error);
    throw new FolderPickerError(error);
  }
}

/** Writes into a picked folder; a failure becomes `FolderWriteError`. */
function writeToFolder(write: () => void): void {
  try {
    write();
  } catch (error) {
    console.warn('Writing to the picked folder failed', error);
    throw new FolderWriteError(error);
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

/**
 * Saves into a folder the user picks; returns false when cancelled. Throws `FolderPickerError` or
 * `FolderWriteError` on failure.
 */
export async function saveToPickedDirectory(name: string, mimeType: string, content: string): Promise<boolean> {
  const directory = await pickDirectory();
  if (!directory) return false;
  writeToFolder(() => directory.createFile(name, mimeType).write(content));
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
  const directory = await pickDirectory();
  if (!directory) return false;
  writeToFolder(() => directory.createFile(name, mimeType).write(base64, { encoding: 'base64' }));
  return true;
}

/**
 * Writes a file in chunks into the cache, gathering them so the disk sees few large appends
 * instead of thousands of small ones. `fill` gets the write function and runs synchronously.
 */
export function cacheFileFrom(name: string, fill: (write: (chunk: Uint8Array) => void) => void): File {
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
  const directory = await pickDirectory();
  if (!directory) return false;
  const built = cacheFileFrom(name, fill);
  try {
    // A folder picked through Android's storage access can only be written as a whole.
    writeToFolder(() => directory.createFile(name, mimeType).write(built.bytesSync()));
  } finally {
    built.delete();
  }
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
