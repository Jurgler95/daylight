import { Directory, File } from 'expo-file-system';

import { withLockSuspended } from '@/lib/lock/store';

import type { BackupFolder } from './auto';

/**
 * The automatic backup's folder through Android's storage access. The picker takes a lasting
 * permission for it (expo-file-system calls `takePersistableUriPermission`), so the saved URI
 * still works after a restart, until the user revokes it or deletes the folder.
 */
export function storageFolder(uri: string): BackupFolder {
  const directory = new Directory(uri);
  const files = (): File[] => directory.list().filter((item): item is File => item instanceof File);
  return {
    exists: () => {
      try {
        return directory.exists;
      } catch {
        return false;
      }
    },
    list: () => files().map((file) => file.name),
    write: (name, mimeType, bytes) => {
      // A folder picked through Android's storage access can only be written as a whole (`files.ts`).
      directory.createFile(name, mimeType).write(bytes);
    },
    remove: (name) => {
      files()
        .find((file) => file.name === name)
        ?.delete();
    },
  };
}

/** Lets the user pick the folder; returns its URI, or null when cancelled. */
export async function pickBackupFolder(): Promise<string | null> {
  try {
    const directory = await withLockSuspended(() => Directory.pickDirectoryAsync());
    return directory.uri;
  } catch {
    return null;
  }
}
