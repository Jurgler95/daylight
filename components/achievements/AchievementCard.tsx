import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

import { AppText, Card } from '@/components/ui';
import type { Achievement } from '@/lib/achievements';
import { formatCount } from '@/lib/insights';
import { radius, spacing, tileColors, useTheme } from '@/lib/theme';

import { StarRow, tierColor } from './StarRow';

interface Props {
  achievement: Achievement;
  /** Health Connect is off and nothing came from it yet. */
  needsHealth: boolean;
  /** Pulses an accent frame around the card while true, e.g. when a tap elsewhere led here. */
  highlight?: boolean;
  onLayout?: (event: LayoutChangeEvent) => void;
}

/** One achievement: what it counts, its five stars with their thresholds and the way to the next one. */
export function AchievementCard({ achievement, needsHealth, highlight = false, onLayout }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const frame = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) frame.value = highlight ? 1 : 0;
    else if (highlight) frame.value = withSequence(withTiming(1, { duration: 150 }), withRepeat(withSequence(withTiming(0.35, { duration: 300 }), withTiming(1, { duration: 300 })), 2));
    else frame.value = withTiming(0, { duration: 400 });
  }, [highlight, reduceMotion, frame]);
  const frameStyle = useAnimatedStyle(() => ({ opacity: frame.value }));
  const { key, unit, measure, icon, tiers, best, current, stars, next, progress } = achievement;
  const amount = (value: number) => t(`achievements.units.${unit}`, { count: value, value: formatCount(value) });
  const title = t(`achievements.items.${key}.title`);
  const text = t(`achievements.items.${key}.text`);
  const tile = tileColors[DEFINITION_TILE[achievement.group]]!;
  const locked = stars === 0;

  const facts =
    current === null
      ? t('achievements.total', { value: amount(best) })
      : `${t('achievements.best', { value: amount(best) })} · ${t(measure === 'window' ? 'achievements.lastWeek' : 'achievements.current', { value: amount(current) })}`;
  // Rounded down, so 100 % only shows with the fifth star; at least 1 % as soon as there is anything.
  const percent = best > 0 ? Math.max(1, Math.floor(progress * 100)) : 0;
  const status = needsHealth ? t('achievements.needsHealth') : next === null ? t('achievements.done') : t('achievements.next', { value: amount(next) });

  return (
    <View onLayout={onLayout}>
      <Card tone={next === null ? 'accent' : 'surface'}>
        <View style={styles.head} accessible accessibilityLabel={`${title}. ${text}. ${t('achievements.starLabel', { stars })}. ${t('achievements.progressLabel', { value: percent })}. ${facts}. ${status}`}>
          <View style={[styles.icon, { backgroundColor: locked ? colors.surfaceMuted : tile.soft }]}>
            <MaterialCommunityIcons name={icon} size={22} color={locked ? colors.textMuted : tile.strong} />
          </View>
          <View style={styles.text}>
            <AppText variant="headline">{title}</AppText>
            <AppText variant="caption" muted>
              {text}
            </AppText>
          </View>
        </View>
        <StarRow stars={stars} labels={tiers.map(formatCount)} />
        <View style={styles.progress} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <View style={[styles.track, { backgroundColor: colors.surfaceMuted }]}>
            {/* A sliver as soon as there is anything, so a first step on a long way still shows. */}
            <View style={[styles.fill, { width: `${progress * 100}%`, minWidth: best > 0 ? 6 : 0, backgroundColor: stars === 0 ? colors.accent : tierColor(stars) }]} />
          </View>
          <AppText variant="caption" muted style={styles.percent}>
            {t('achievements.percent', { value: percent })}
          </AppText>
        </View>
        <View style={styles.footer} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <AppText variant="caption" muted>
            {facts}
          </AppText>
          <AppText variant="caption" color={needsHealth ? colors.textMuted : colors.text}>
            {status}
          </AppText>
        </View>
      </Card>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.frame, { borderColor: colors.accent }, frameStyle]} />
    </View>
  );
}

/** Streaks and volume each keep one crayon colour, so the two sections read apart at a glance. */
const DEFINITION_TILE = { streaks: 0, volume: 4 } as const;

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
  progress: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  track: { flex: 1, height: 8, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill },
  percent: { minWidth: 40, textAlign: 'right' },
  footer: { gap: 2 },
  frame: { borderRadius: radius.lg, borderWidth: 3 },
});
