import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Easing, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { AppText } from '@/components/ui';
import { formatLong, type DateString } from '@/lib/dates';
import type { InsightDay } from '@/lib/insights';
import { radius, spacing } from '@/lib/theme';

import { DAWN } from './dawn';
import { INTRO_MS, SunriseScene } from './SunriseScene';

interface Props {
  title: string;
  date: DateString;
  days: readonly InsightDay[];
}

/** Scattered once, as shares of the card: x, y and a size. */
const STARS = [
  [0.07, 0.08, 1.5],
  [0.21, 0.2, 1],
  [0.4, 0.06, 1.5],
  [0.63, 0.15, 1],
  [0.78, 0.05, 2],
  [0.92, 0.22, 1],
  [0.12, 0.38, 1],
  [0.86, 0.4, 1.5],
] as const;

/**
 * The head of a turning point's page: the same dawn as when it was set. The horizon draws out and
 * the sun rises over the day once more, lighting up the days after it.
 */
export function TurningHero({ title, date, days }: Props) {
  const { t } = useTranslation();
  const progress = useSharedValue(0);
  const burst = useSharedValue(0);
  useEffect(() => {
    progress.value = withDelay(INTRO_MS * 0.7, withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.cubic) }));
  }, [progress]);

  return (
    <View style={styles.card}>
      <LinearGradient colors={[DAWN.sky, DAWN.skyMid, DAWN.skyLow]} locations={[0, 0.6, 1]} style={StyleSheet.absoluteFill} />
      {STARS.map(([x, y, size], i) => (
        <View key={i} style={[styles.star, { left: `${x * 100}%`, top: `${y * 100}%`, width: size * 2, height: size * 2, borderRadius: size }]} />
      ))}
      <View style={styles.head}>
        <AppText variant="caption" color={DAWN.sun} style={styles.eyebrow}>
          {`${t('turning.eyebrow')} · ${formatLong(date)}`.toUpperCase()}
        </AppText>
        <AppText variant="title" color={DAWN.text} accessibilityRole="header" style={styles.centered}>
          {title}
        </AppText>
      </View>
      <SunriseScene days={days} date={date} progress={progress} burst={burst} />
      <View style={styles.legend} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <AppText variant="caption" color={DAWN.textSoft}>
          {t('turning.before')}
        </AppText>
        <AppText variant="caption" color={DAWN.textSoft}>
          {t('turning.after')}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, overflow: 'hidden', padding: spacing.lg, gap: spacing.sm },
  star: { position: 'absolute', backgroundColor: DAWN.star, opacity: 0.8 },
  head: { alignItems: 'center', gap: spacing.xs, paddingTop: spacing.sm },
  eyebrow: { letterSpacing: 2, textAlign: 'center' },
  centered: { textAlign: 'center' },
  legend: { flexDirection: 'row', justifyContent: 'space-between' },
});
