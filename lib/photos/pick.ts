import { File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { withLockSuspended } from '@/lib/lock/store';

import { photoFile } from './fileStore';
import { newPhotoName } from './store';

/** Long edge of a stored photo: sharp on a phone screen, about 300 KB, so years of days stay small. */
export const MAX_EDGE = 1600;
const QUALITY = 0.8;

/** Photos one entry can take from the app; more arrive only through an import. */
export const MAX_PHOTOS = 10;

/**
 * Lets the user pick up to `limit` photos with the system photo picker (no storage permission),
 * scales each down and stores a JPEG copy in the private photo folder. Returns the file names in
 * the order picked, empty when nothing was picked. The copies have no row yet; the editor adds them
 * on "Speichern", and a photo that never gets saved is swept on the next start.
 */
export async function pickPhotos(limit: number): Promise<string[]> {
  if (limit <= 0) return [];
  // The picker is a system screen of its own; coming back from it must not lock the app.
  const result = await withLockSuspended(() =>
    ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
      exif: false,
      allowsMultipleSelection: limit > 1,
      selectionLimit: limit,
      orderedSelection: true,
    }),
  );
  if (result.canceled) return [];
  const names: string[] = [];
  for (const asset of result.assets.slice(0, limit)) names.push(await storeAsset(asset));
  return names;
}

async function storeAsset(asset: ImagePicker.ImagePickerAsset): Promise<string> {
  const context = ImageManipulator.manipulate(asset.uri);
  if (Math.max(asset.width, asset.height) > MAX_EDGE) {
    context.resize(asset.width >= asset.height ? { width: MAX_EDGE } : { height: MAX_EDGE });
  }
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: QUALITY });
  const name = newPhotoName();
  const source = new File(saved.uri);
  source.moveSync(photoFile(name));
  dropPickerCopy(asset.uri);
  return name;
}

/**
 * The picker hands over a full-size copy in the app's cache; once the scaled copy is stored it is
 * not needed. Only a file inside the cache goes, never the original in the gallery.
 */
function dropPickerCopy(uri: string): void {
  if (!uri.startsWith(Paths.cache.uri)) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Left for "Alle Daten löschen", which clears the cache.
  }
}
