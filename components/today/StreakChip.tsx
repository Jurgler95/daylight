import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { AppText, PressableScale } from '@/components/ui';
import { formatCount } from '@/lib/insights';
import type { StreakChipTone, StreakChipView } from '@/lib/streak';
import { TOUCH_TARGET, radius, spacing, useTheme } from '@/lib/theme';

/** A filled flame while today is in or yesterday is waiting to be filled in, an outline otherwise. */
const ICONS: Record<StreakChipTone, keyof typeof Ionicons.glyphMap> = { outline: 'flame-outline', filled: 'flame', amber: 'flame', muted: 'flame-outline' };

interface Props {
  view: StreakChipView;
  /** Counts up for every pulse to play. */
  pulse: number;
  onPress: () => void;
}

/**
 * The streak next to the title on "Heute": a flame and the number of days. Outlined until today
 * has an entry, filled after, amber while yesterday is missing, muted while a broken streak waits
 * to be filled in. Pulses after a save that reached a milestone.
 */
export function StreakChip({ view, pulse, onPress }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const ring = useSharedValue(0);

  useEffect(() => {
    if (pulse === 0 || reduceMotion) return;
    const beat = withSequence(withTiming(1.2, { duration: 140, easing: Easing.out(Easing.cubic) }), withTiming(1, { duration: 220 }));
    scale.value = withSequence(beat, beat);
    ring.value = withSequence(withTiming(1, { duration: 0 }), withTiming(0, { duration: 900, easing: Easing.out(Easing.quad) }));
  }, [pulse, reduceMotion, scale, ring]);

  const bounce = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const halo = useAnimatedStyle(() => ({ opacity: ring.value, transform: [{ scale: 1 + (1 - ring.value) * 0.5 }] }));

  const tone = {
    outline: { background: colors.surface, border: colors.accent, text: colors.accent },
    filled: { background: colors.accent, border: colors.accent, text: colors.textOnAccent },
    amber: { background: colors.amberSoft, border: colors.amber, text: colors.amber },
    muted: { background: colors.surfaceMuted, border: colors.border, text: colors.textMuted },
  }[view.tone];

  const days = t('streak.days', { count: view.days, value: formatCount(view.days) });
  const label = view.tone === 'amber' ? `${t('streak.chip.atRisk')}. ${days}` : view.tone === 'muted' ? `${t('streak.chip.broken')}. ${days}` : days;

  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={label} accessibilityHint={t('streak.chip.hint')} hitSlop={4}>
      <Animated.View style={bounce}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.halo, { borderColor: tone.border }, halo]} />
        <View style={[styles.chip, { backgroundColor: tone.background, borderColor: tone.border }]}>
          <Ionicons name={ICONS[view.tone]} size={18} color={tone.text} />
          <AppText variant="label" color={tone.text}>
            {formatCount(view.days)}
          </AppText>
        </View>
      </Animated.View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: TOUCH_TARGET,
    minWidth: TOUCH_TARGET,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  halo: { borderRadius: radius.pill, borderWidth: 2 },
});
