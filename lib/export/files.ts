import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/** Native side of export/import. Everything stays on the device unless the user shares. */

function cacheFile(name: string): File {
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  return file;
}

export async function shareText(name: string, mimeType: string, content: string): Promise<void> {
  const file = cacheFile(name);
  file.write(content);
  if (!(await Sharing.isAvailableAsync())) throw new Error('Teilen nicht verfügbar');
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: name });
}

/** Storage Access Framework: the user picks a folder (e.g. Downloads); returns false when cancelled. */
export async function saveToPickedDirectory(name: string, mimeType: string, content: string): Promise<boolean> {
  let directory: Directory;
  try {
    directory = await Directory.pickDirectoryAsync();
  } catch {
    return false;
  }
  const file = directory.createFile(name, mimeType);
  file.write(content);
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
  if (!(await Sharing.isAvailableAsync())) throw new Error('Teilen nicht verfügbar');
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: name });
}

/** Like `saveToPickedDirectory`, for a file built in chunks (the backup ZIP). */
export async function saveBinaryToPickedDirectory(name: string, mimeType: string, fill: (write: (chunk: Uint8Array) => void) => void): Promise<boolean> {
  let directory: Directory;
  try {
    directory = await Directory.pickDirectoryAsync();
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
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/csv', 'text/comma-separated-values', 'text/plain', 'application/zip', 'application/octet-stream', '*/*'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset) return null;
  const file = new File(asset.uri);
  const bytes = await file.bytes();
  // The picker's cache copy holds a whole journal; it is read now and not needed again.
  if (file.exists) file.delete();
  return { name: asset.name, bytes };
}
