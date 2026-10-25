import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming, ZoomIn } from 'react-native-reanimated';

import { AppText } from '@/components/ui';
import { MAX_STARS, type Achievement } from '@/lib/achievements';
import { haptics } from '@/lib/haptics';
import { formatCount } from '@/lib/insights';
import { radius, spacing, trophyGradient, trophySoftText, useTheme, withAlpha } from '@/lib/theme';

import { TierStar } from './StarRow';
import { ToGo, useToGoText } from './ToGo';

/** Gold for the trophy and the overall bar; decorative, the numbers next to them say it in words. */
const GOLD = ['#FFE27A', '#FFB300'] as const;

interface Props {
  stars: number;
  complete: number;
  total: number;
  /** 0..1, the average of every card's bar. */
  progress: number;
  /** The achievement closest to its next star, or null once every star is there. */
  upNext: Achievement | null;
  onUpNext: (achievement: Achievement) => void;
}

/** The top of the achievements tab: all stars so far, the way to all of them, and the next star in reach. */
export function AchievementsHero({ stars, complete, total, progress, upNext, onUpNext }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const toGoText = useToGoText();
  const reduceMotion = useReducedMotion();
  const percent = Math.floor(progress * 100);
  const summary = t('achievements.stars', { stars: formatCount(stars), max: formatCount(MAX_STARS) });

  // The bar fills up once the tab appears, from nothing to where all achievements stand.
  const fill = useSharedValue(reduceMotion ? progress : 0);
  useEffect(() => {
    fill.value = reduceMotion ? progress : withDelay(150, withTiming(progress, { duration: 900, easing: Easing.out(Easing.cubic) }));
  }, [progress, reduceMotion, fill]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));

  return (
    <LinearGradient colors={trophyGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
      {/* Sparks scattered over the corner, decorative only. */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <MaterialCommunityIcons name="star-four-points" size={18} color={withAlpha('#FFFFFF', 0.35)} style={[styles.spark, { top: 14, right: 22 }]} />
        <MaterialCommunityIcons name="star-four-points" size={11} color={withAlpha('#FFE27A', 0.6)} style={[styles.spark, { top: 44, right: 56 }]} />
        <MaterialCommunityIcons name="star-four-points" size={26} color={withAlpha('#FFFFFF', 0.18)} style={[styles.spark, { top: 70, right: 14 }]} />
      </View>
      <View style={styles.summary} accessible accessibilityLabel={`${summary}. ${t('achievements.complete', { count: complete, total })}. ${t('achievements.overallLabel', { value: percent })}`}>
        <Animated.View entering={reduceMotion ? undefined : ZoomIn.springify().damping(12).delay(100)} style={styles.trophyHalo}>
          <LinearGradient colors={GOLD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.trophy}>
            <MaterialCommunityIcons name="trophy" size={38} color="#7A4A00" />
          </LinearGradient>
        </Animated.View>
        <View style={styles.summaryText}>
          <AppText variant="display" color={colors.textOnAccent}>
            {t('achievements.starsShort', { stars: formatCount(stars), max: formatCount(MAX_STARS) })}
          </AppText>
          <AppText variant="label" color={trophySoftText}>
            {t('achievements.complete', { count: complete, total })}
          </AppText>
        </View>
      </View>
      <View style={styles.progress} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <View style={[styles.track, { backgroundColor: withAlpha('#FFFFFF', 0.22) }]}>
          <Animated.View style={[styles.fillBox, { minWidth: progress > 0 ? 12 : 0 }, fillStyle]}>
            <LinearGradient colors={GOLD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.fill} />
          </Animated.View>
        </View>
        <AppText variant="label" color={colors.textOnAccent} style={styles.percent}>
          {t('achievements.percent', { value: percent })}
        </AppText>
      </View>
      {upNext && upNext.remaining !== null ? (
        <Pressable
          onPress={() => {
            haptics.tap();
            onUpNext(upNext);
          }}
          accessibilityRole="button"
          accessibilityLabel={`${t('achievements.upNext')}: ${t(`achievements.items.${upNext.key}.title`)}, ${toGoText(upNext.unit, upNext.remaining)}`}
          style={({ pressed }) => [styles.upNext, { opacity: pressed ? 0.75 : 1 }]}
        >
          <View style={styles.upNextStar}>
            <TierStar index={upNext.stars} earned size={26} />
          </View>
          <View style={styles.upNextText}>
            <AppText variant="caption" color={trophySoftText}>
              {t('achievements.upNext').toUpperCase()}
            </AppText>
            <AppText variant="headline" color={colors.textOnAccent} numberOfLines={1}>
              {t(`achievements.items.${upNext.key}.title`)}
            </AppText>
          </View>
          <ToGo unit={upNext.unit} remaining={upNext.remaining} color={colors.textOnAccent} size={26} />
          <MaterialCommunityIcons name="chevron-right" size={22} color={trophySoftText} />
        </Pressable>
      ) : null}
      <AppText variant="caption" color={trophySoftText}>
        {t('achievements.intro')}
      </AppText>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: radius.lg, padding: spacing.xl, gap: spacing.lg, overflow: 'hidden' },
  spark: { position: 'absolute' },
  summary: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  summaryText: { flex: 1, gap: 2 },
  trophyHalo: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', backgroundColor: withAlpha('#FFE27A', 0.25) },
  trophy: { width: 62, height: 62, borderRadius: 31, alignItems: 'center', justifyContent: 'center' },
  progress: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  percent: { minWidth: 44, textAlign: 'right' },
  track: { flex: 1, height: 12, borderRadius: radius.pill, overflow: 'hidden' },
  fillBox: { height: '100%' },
  fill: { flex: 1, borderRadius: radius.pill },
  upNext: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: 'rgba(8, 12, 40, 0.24)',
  },
  upNextStar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: withAlpha('#FFFFFF', 0.16) },
  upNextText: { flex: 1, gap: 2 },
});
