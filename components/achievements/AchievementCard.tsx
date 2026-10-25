import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

import { AppText, Card } from '@/components/ui';
import type { Achievement } from '@/lib/achievements';
import { formatCount } from '@/lib/insights';
import { radius, spacing, tileColors, trophyGradient, useTheme, withAlpha } from '@/lib/theme';

import { StarRow, TierStar, tierColor } from './StarRow';
import { ToGo, useToGoText } from './ToGo';

interface Props {
  achievement: Achievement;
  /** Health Connect is off and nothing came from it yet. */
  needsHealth: boolean;
  /** Pulses an accent frame around the card while true, e.g. when a tap elsewhere led here. */
  highlight?: boolean;
  /** Place on the page, so the cards rise in one after the other. */
  index?: number;
  onLayout?: (event: LayoutChangeEvent) => void;
}

/** One achievement: what it counts, its five stars with their thresholds and how much the next one still needs. */
export function AchievementCard({ achievement, needsHealth, highlight = false, index = 0, onLayout }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const toGoText = useToGoText();
  const reduceMotion = useReducedMotion();
  const frame = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) frame.value = highlight ? 1 : 0;
    else if (highlight) frame.value = withSequence(withTiming(1, { duration: 150 }), withRepeat(withSequence(withTiming(0.35, { duration: 300 }), withTiming(1, { duration: 300 })), 2));
    else frame.value = withTiming(0, { duration: 400 });
  }, [highlight, reduceMotion, frame]);
  const frameStyle = useAnimatedStyle(() => ({ opacity: frame.value }));
  const { key, unit, measure, icon, tiers, best, current, stars, next, progress, remaining } = achievement;
  const amount = (value: number) => t(`achievements.units.${unit}`, { count: value, value: formatCount(value) });
  const title = t(`achievements.items.${key}.title`);
  const text = t(`achievements.items.${key}.text`);
  const tile = tileColors[DEFINITION_TILE[achievement.group]]!;
  const locked = stars === 0;
  const done = next === null || remaining === null;
  const barColor = locked ? colors.accent : tierColor(stars);
  // The star that comes next, so the countdown wears the colour of what it leads to.
  const nextColor = tierColor(stars + 1);

  const currentKey = measure === 'window' ? 'achievements.lastWeek' : 'achievements.current';
  const facts =
    current === null
      ? t('achievements.total', { value: amount(best) })
      : `${t('achievements.best', { value: amount(best) })} · ${t(currentKey, { value: amount(current) })}`;
  // On the card the way to the next star reads as a fraction, "27/30 Aktivitäten": a run or a
  // window from where it stands now, a total from what it has, as the countdown counts. One line
  // each, so a value never breaks away from its label next to the countdown.
  const fraction = (value: number, goal: number) =>
    t(`achievements.units.${unit}`, { count: goal, value: `${formatCount(value)}/${formatCount(goal)}` });
  const factLines =
    current === null
      ? [done ? t('achievements.total', { value: amount(best) }) : fraction(best, next)]
      : [t(currentKey, { value: done ? amount(current) : fraction(current, next) }), t('achievements.best', { value: amount(best) })];
  // Rounded down, so 100 % only shows with the fifth star; at least 1 % as soon as there is anything.
  const percent = best > 0 ? Math.max(1, Math.floor(progress * 100)) : 0;
  const status = needsHealth
    ? t('achievements.needsHealth')
    : done
      ? t('achievements.done')
      : `${t('achievements.next', { value: amount(next) })}, ${toGoText(unit, remaining)}`;

  return (
    <Animated.View onLayout={onLayout} entering={reduceMotion ? undefined : FadeInDown.delay(Math.min(index, 8) * 45).duration(260)}>
      <Card tone={done ? 'accent' : 'surface'}>
        <View style={styles.head} accessible accessibilityLabel={`${title}. ${text}. ${t('achievements.starLabel', { stars })}. ${t('achievements.progressLabel', { value: percent })}. ${facts}. ${status}`}>
          {locked ? (
            <View style={[styles.icon, { backgroundColor: colors.surfaceMuted }]}>
              <MaterialCommunityIcons name={icon} size={22} color={colors.textMuted} />
            </View>
          ) : (
            <View style={[styles.icon, { backgroundColor: tile.soft, borderColor: withAlpha(barColor, 0.55), borderWidth: 2 }]}>
              <MaterialCommunityIcons name={icon} size={22} color={tile.strong} />
            </View>
          )}
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
            <LinearGradient
              colors={[withAlpha(barColor, 0.55), barColor]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.fill, { width: `${progress * 100}%`, minWidth: best > 0 ? 8 : 0 }]}
            />
          </View>
          <AppText variant="caption" muted style={styles.percent}>
            {t('achievements.percent', { value: percent })}
          </AppText>
        </View>
        <View style={styles.footer} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <View style={styles.facts}>
            {factLines.map((line) => (
              <AppText key={line} variant="caption" muted>
                {line}
              </AppText>
            ))}
            {needsHealth ? (
              <AppText variant="caption" muted>
                {status}
              </AppText>
            ) : null}
          </View>
          {needsHealth ? null : done ? (
            <LinearGradient colors={trophyGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.badge}>
              <MaterialCommunityIcons name="party-popper" size={18} color={colors.textOnAccent} />
              <AppText variant="label" color={colors.textOnAccent}>
                {t('achievements.doneBadge')}
              </AppText>
            </LinearGradient>
          ) : (
            <View style={[styles.badge, { backgroundColor: withAlpha(nextColor, 0.14), borderColor: withAlpha(nextColor, 0.5) }]}>
              <TierStar index={stars} earned size={18} />
              <ToGo unit={unit} remaining={remaining} color={colors.text} />
            </View>
          )}
        </View>
      </Card>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.frame, { borderColor: colors.accent }, frameStyle]} />
    </Animated.View>
  );
}

/** Streaks and volume each keep one crayon colour, so the two sections read apart at a glance. */
const DEFINITION_TILE = { streaks: 0, volume: 4 } as const;

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
  progress: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  track: { flex: 1, height: 10, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill },
  percent: { minWidth: 40, textAlign: 'right' },
  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  facts: { flex: 1, gap: 2 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingLeft: spacing.xs,
    paddingRight: spacing.md,
    minHeight: 40,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: 'transparent',
    flexShrink: 1,
  },
  frame: { borderRadius: radius.lg, borderWidth: 3 },
});
