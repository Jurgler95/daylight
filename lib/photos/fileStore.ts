import { Directory, File, Paths } from 'expo-file-system';

import { assertPhotoName, type PhotoStore } from './store';

/**
 * Photos in the app's private document folder. Not the gallery, not the cache: nothing else can
 * read them, Android does not clear them, and with `allowBackup` off they leave the phone only in
 * a Daylight backup.
 */
function folder(): Directory {
  const dir = new Directory(Paths.document, 'photos');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

export function photoFile(name: string): File {
  return new File(folder(), assertPhotoName(name));
}

/** For `<Image source={{ uri }}>`. */
export function photoUri(name: string): string {
  return photoFile(name).uri;
}

export const filePhotoStore: PhotoStore = {
  has: (name) => photoFile(name).exists,
  read: (name) => photoFile(name).bytesSync(),
  write: (name, bytes) => {
    const file = photoFile(name);
    if (file.exists) file.delete();
    file.write(bytes);
  },
  remove: (name) => {
    const file = photoFile(name);
    if (file.exists) file.delete();
  },
  list: () =>
    folder()
      .list()
      .filter((item): item is File => item instanceof File)
      .map((file) => file.name),
};

/** "Alle Daten löschen": the folder goes with the database. */
export function deleteAllPhotoFiles(): void {
  const dir = new Directory(Paths.document, 'photos');
  if (dir.exists) dir.delete();
}
