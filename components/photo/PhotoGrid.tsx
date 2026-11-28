import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { radius, spacing, TOUCH_TARGET, useTheme } from '@/lib/theme';

import { Photo } from './Photo';

interface Props {
  photos: readonly string[];
  /** Spoken on a photo, which opens it full screen. */
  openLabel: string;
  /** With it, every photo gets a remove button; without, the grid only shows. */
  onRemove?: (name: string) => void;
  removeLabel?: string;
}

/**
 * The photos of an entry. One photo spans the width; with more, they sit two by two as squares,
 * and an odd count lets the first one span the width above the pairs. A photo opens itself full screen.
 */
export function PhotoGrid({ photos, openLabel, onRemove, removeLabel }: Props) {
  const { colors } = useTheme();
  if (photos.length === 0) return null;

  const wide = photos.length % 2 === 1 ? photos[0] : null;
  const rest = wide ? photos.slice(1) : [...photos];
  const pairs: string[][] = [];
  for (let i = 0; i < rest.length; i += 2) pairs.push(rest.slice(i, i + 2));

  const tile = (name: string, style: object) => (
    <View key={name} style={style}>
      <Pressable
        onPress={() => router.push({ pathname: '/photo/[name]', params: { name } })}
        accessibilityRole="imagebutton"
        accessibilityLabel={openLabel}
        style={styles.flex}
      >
        <Photo name={name} style={[styles.fill, { backgroundColor: colors.surfaceMuted }]} />
      </Pressable>
      {onRemove ? (
        <Pressable
          onPress={() => onRemove(name)}
          accessibilityRole="button"
          accessibilityLabel={removeLabel}
          hitSlop={spacing.xs}
          style={({ pressed }) => [styles.remove, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Ionicons name="trash-outline" size={20} color="#FFFFFF" />
        </Pressable>
      ) : null}
    </View>
  );

  return (
    <View style={styles.grid}>
      {wide ? tile(wide, styles.wide) : null}
      {pairs.map((pair) => (
        <View key={pair.join('|')} style={styles.pair}>
          {pair.map((name) => tile(name, styles.square))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  fill: { width: '100%', height: '100%', borderRadius: radius.md },
  grid: { gap: spacing.xs },
  pair: { flexDirection: 'row', gap: spacing.xs },
  wide: { width: '100%', aspectRatio: 4 / 3 },
  square: { flex: 1, aspectRatio: 1 },
  remove: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    borderRadius: TOUCH_TARGET / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
});
