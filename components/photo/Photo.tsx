import { Image } from 'expo-image';
import type { ImageStyle, StyleProp } from 'react-native';

import { photoUri } from '@/lib/photos/fileStore';

interface Props {
  name: string;
  style?: StyleProp<ImageStyle>;
  fit?: 'cover' | 'contain';
  accessibilityLabel?: string;
}

/**
 * One stored photo. Read straight from the private folder; `cachePolicy` "memory" keeps expo-image
 * from putting a second copy into its disk cache, where "Alle Daten löschen" would not reach it.
 */
export function Photo({ name, style, fit = 'cover', accessibilityLabel }: Props) {
  return (
    <Image
      source={{ uri: photoUri(name) }}
      style={style}
      contentFit={fit}
      cachePolicy="memory"
      recyclingKey={name}
      transition={120}
      accessibilityLabel={accessibilityLabel}
      accessible={accessibilityLabel !== undefined}
    />
  );
}
