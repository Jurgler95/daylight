import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image } from 'react-native';

/**
 * Where the MaterialCommunityIcons font is for native code that draws mood icons itself (widgets,
 * reminder buttons): its resource name in a release build, a Metro URL in development, which native
 * code ignores. Null when it cannot be resolved.
 */
export function iconFont(): string | null {
  try {
    return Image.resolveAssetSource(MaterialCommunityIcons.font['material-community'] as number)?.uri ?? null;
  } catch {
    return null;
  }
}

/** Code points of the icons by name, for native code that draws them from the font. */
export function iconGlyphs(): Readonly<Record<string, number | string>> {
  return MaterialCommunityIcons.getRawGlyphMap();
}
