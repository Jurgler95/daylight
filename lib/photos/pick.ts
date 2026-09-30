import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { photoFile } from './fileStore';
import { newPhotoName } from './store';

/** Long edge of a stored photo: sharp on a phone screen, about 300 KB, so years of days stay small. */
export const MAX_EDGE = 1600;
const QUALITY = 0.8;

/**
 * Lets the user pick one photo with the system photo picker (no storage permission), scales it
 * down and stores a JPEG copy in the private photo folder. Returns the file name, or null when
 * nothing was picked. The copy has no row yet; the editor adds it on "Speichern", and a photo that
 * never gets saved is swept on the next start.
 */
export async function pickPhoto(): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, exif: false });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset) return null;

  const context = ImageManipulator.manipulate(asset.uri);
  if (Math.max(asset.width, asset.height) > MAX_EDGE) {
    context.resize(asset.width >= asset.height ? { width: MAX_EDGE } : { height: MAX_EDGE });
  }
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: QUALITY });
  const name = newPhotoName();
  const source = new File(saved.uri);
  source.moveSync(photoFile(name));
  return name;
}
