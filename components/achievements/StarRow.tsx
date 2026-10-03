import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { TIER_COUNT } from '@/lib/achievements';
import { moodColors, spacing, useTheme, withAlpha } from '@/lib/theme';

/** Warm gold for an earned star; the outline against the filled glyph carries the meaning too. */
export const STAR_COLOR = moodColors[3].strong;

/**
 * Each star looks a little better than the one before: bronze, silver and gold as plain stars, then
 * a gold medallion and, for the fifth, a shimmering one with a spark. Decorative only.
 */
const TIERS: readonly { color: string; outline?: string; medal?: readonly [string, string, ...string[]]; spark?: boolean }[] = [
  { color: '#C98545', outline: '#7A4520' },
  { color: '#A9B4C0', outline: '#56616D' },
  { color: '#F2B705', outline: '#7A5800' },
  { color: '#E09B00', medal: ['#FFD54A', '#E09B00'] },
  { color: '#7B3FE4', medal: ['#FF8AD8', '#9A5CFF', '#3FB8FF'], spark: true },
];

/** Colour of the highest earned star, for things that follow the achievement's standing. */
export function tierColor(stars: number): string {
  return stars === 0 ? STAR_COLOR : TIERS[Math.min(stars, TIER_COUNT) - 1]!.color;
}

/** The star at `index` (0-based), earned or still an outline. Takes up `size` plus a little room for the medallions. */
export function TierStar({ index, earned, size = 26 }: { index: number; earned: boolean; size?: number }) {
  const { colors } = useTheme();
  const tier = TIERS[index]!;
  const box = Math.round(size * 1.3);
  if (!earned) {
    return (
      <View style={[styles.slot, { width: box, height: box }]}>
        <MaterialCommunityIcons name="star-outline" size={size} color={colors.border} />
      </View>
    );
  }
  if (!tier.medal) {
    // A darker outline over the fill, so even the first stars stand out on a light card.
    return (
      <View style={[styles.slot, { width: box, height: box }]}>
        <MaterialCommunityIcons name="star" size={size} color={tier.color} />
        <MaterialCommunityIcons name="star-outline" size={size} color={tier.outline} style={styles.outline} />
      </View>
    );
  }
  return (
    <View style={[styles.slot, { width: box, height: box }]}>
      <View style={[styles.halo, { width: box, height: box, borderRadius: box / 2, backgroundColor: withAlpha(tier.color, 0.22) }]} />
      <LinearGradient
        colors={tier.medal}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ width: box - 4, height: box - 4, borderRadius: (box - 4) / 2, alignItems: 'center', justifyContent: 'center' }}
      >
        <MaterialCommunityIcons name="star" size={Math.round(size * 0.78)} color="#FFFFFF" />
      </LinearGradient>
      {tier.spark ? (
        <View style={styles.spark}>
          <MaterialCommunityIcons name="star-four-points" size={Math.round(size * 0.42)} color="#FFC1EC" />
        </View>
      ) : null}
    </View>
  );
}

interface Props {
  stars: number;
  /** One threshold per star, shown underneath. */
  labels?: readonly string[];
  size?: number;
}

/** Five stars, the earned ones filled. Decorative for the screen reader; the card says it in words. */
export function StarRow({ stars, labels, size = 26 }: Props) {
  return (
    <View style={styles.row} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {Array.from({ length: TIER_COUNT }, (_, index) => {
        const earned = index < stars;
        return (
          <View key={index} style={styles.star}>
            <TierStar index={index} earned={earned} size={size} />
            {labels ? (
              <AppText variant="caption" muted={!earned} numberOfLines={1}>
                {labels[index]}
              </AppText>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.xs },
  star: { flex: 1, alignItems: 'center', gap: 2 },
  slot: { alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute' },
  outline: { position: 'absolute' },
  spark: { position: 'absolute', top: -2, right: -2 },
});
