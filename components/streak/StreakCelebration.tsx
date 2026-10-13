import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BackHandler, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  FadeOutUp,
  SlideInUp,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui';
import { haptics } from '@/lib/haptics';
import { formatCount } from '@/lib/insights';
import { celebrationStage, type StreakCelebration as Celebration } from '@/lib/streak';
import { useStreakCelebration } from '@/lib/streak/useStreak';
import { radius, spacing, TOUCH_TARGET, useTheme, withAlpha } from '@/lib/theme';

/** How long the banner stays before it slides away by itself. */
export const BANNER_MS = 6000;
/** Wait for the editor to finish closing, so the banner does not fly in under its exit. */
export const CELEBRATION_DELAY_MS = 450;
const PARTICLES = 18;
/** Warm sparks around the big number; decorative, the words carry the news. */
const SPARK_COLORS = ['#FFB300', '#FF7043', '#1A5FC2', '#00897B'] as const;

/**
 * The banner (a streak of 50, 100 ... days, or a gap closed) or the overlay (every 200 days) after
 * a save in the editor. Never over an open entry or the lock screen, and one after the other with
 * the star message.
 */
export function StreakCelebration() {
  const { celebration, dismiss } = useStreakCelebration();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!celebration) return setReady(false);
    const timeout = setTimeout(() => setReady(true), CELEBRATION_DELAY_MS);
    return () => clearTimeout(timeout);
  }, [celebration]);
  if (!celebration || !ready) return null;
  // Keyed by its content, so a newer celebration starts its own entrance and timer.
  const key = `${celebration.milestone}-${celebration.rescued}-${celebration.days}`;
  return celebrationStage(celebration) === 'overlay' ? (
    <Overlay key={key} celebration={celebration} close={dismiss} />
  ) : (
    <Banner key={key} celebration={celebration} close={dismiss} />
  );
}

type T = ReturnType<typeof useTranslation>['t'];

function describe(celebration: Celebration, t: T): { title: string; detail: string } {
  const value = formatCount(celebration.days);
  if (celebration.milestone) {
    return {
      title: t('streak.days', { count: celebration.days, value }),
      detail: celebration.rescued ? t('streak.celebration.rescuedShort') : t('streak.celebration.milestone'),
    };
  }
  return { title: t('streak.celebration.rescued', { count: celebration.days, value }), detail: t('streak.celebration.gapClosed') };
}

function openStreak(close: () => void) {
  haptics.tap();
  close();
  router.navigate({ pathname: '/achievements', params: { focus: 'days' } });
}

function Banner({ celebration, close }: { celebration: Celebration; close: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const flame = useSharedValue(1);
  const done = useRef(false);
  const finish = () => {
    if (done.current) return;
    done.current = true;
    close();
  };

  useEffect(() => {
    haptics.confirm();
    if (!reduceMotion) flame.value = withDelay(200, withSequence(withTiming(1.25, { duration: 160 }), withSpring(1, { damping: 6, stiffness: 240 })));
    const timeout = setTimeout(finish, BANNER_MS);
    return () => clearTimeout(timeout);
    // Runs once per banner; `finish` only reads a ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const flameStyle = useAnimatedStyle(() => ({ transform: [{ scale: flame.value }] }));
  const text = describe(celebration, t);

  return (
    <Animated.View
      entering={reduceMotion ? undefined : SlideInUp.springify().damping(17).stiffness(320).mass(0.8)}
      exiting={reduceMotion ? undefined : FadeOutUp.duration(140)}
      style={[styles.bannerWrap, { top: insets.top + spacing.sm }]}
    >
      <Pressable
        onPress={() => openStreak(finish)}
        accessibilityRole="button"
        accessibilityLabel={`${t('streak.celebration.eyebrow')}. ${text.title}. ${text.detail}. ${t('streak.celebration.openLabel')}`}
        accessibilityLiveRegion="polite"
        style={({ pressed }) => [
          styles.banner,
          { backgroundColor: colors.surface, borderColor: withAlpha(colors.accent, 0.35), shadowColor: colors.accent, transform: [{ scale: pressed ? 0.98 : 1 }] },
        ]}
      >
        <LinearGradient colors={[colors.accentSoft, colors.surface]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <Animated.View style={[styles.flame, { backgroundColor: colors.accent }, flameStyle]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <Ionicons name="flame" size={28} color={colors.textOnAccent} />
        </Animated.View>
        <View style={styles.bannerText}>
          <AppText variant="caption" color={colors.accent}>
            {t('streak.celebration.eyebrow').toUpperCase()}
          </AppText>
          <AppText variant="headline" numberOfLines={1}>
            {text.title}
          </AppText>
          <AppText variant="caption" muted numberOfLines={2}>
            {text.detail}
          </AppText>
        </View>
        <Pressable
          onPress={() => {
            haptics.off();
            finish();
          }}
          accessibilityRole="button"
          accessibilityLabel={t('streak.celebration.close')}
          hitSlop={8}
          style={({ pressed }) => [styles.close, { opacity: pressed ? 0.5 : 1 }]}
        >
          <Ionicons name="close" size={20} color={colors.textMuted} />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

/** Every 200 days: the number takes the screen, sparks fly out, a tap anywhere or back puts it away. */
function Overlay({ celebration, close }: { celebration: Celebration; close: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const pop = useSharedValue(reduceMotion ? 1 : 0.6);
  const burst = useSharedValue(0);

  useEffect(() => {
    haptics.celebrate();
    if (!reduceMotion) {
      pop.value = withSpring(1, { damping: 9, stiffness: 160 });
      burst.value = withDelay(120, withTiming(1, { duration: 1400, easing: Easing.out(Easing.cubic) }));
    }
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => back.remove();
    // Runs once per overlay.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const numberStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  const text = describe(celebration, t);

  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeIn.duration(200)}
      exiting={reduceMotion ? undefined : FadeOut.duration(160)}
      style={[StyleSheet.absoluteFill, styles.overlay, { backgroundColor: withAlpha(colors.text, 0.55) }]}
      accessibilityViewIsModal
    >
      <Pressable style={StyleSheet.absoluteFill} onPress={close} accessible={false} importantForAccessibility="no" />
      <View style={[styles.panel, { backgroundColor: colors.surface }]} accessibilityLiveRegion="polite">
        {reduceMotion ? null : (
          <View style={styles.sparks} pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            {Array.from({ length: PARTICLES }, (_, index) => (
              <Particle key={index} index={index} burst={burst} />
            ))}
          </View>
        )}
        <Ionicons name="flame" size={40} color={colors.accent} importantForAccessibility="no" />
        <Animated.View style={numberStyle} accessible accessibilityLabel={`${text.title}. ${text.detail}`}>
          <AppText variant="display" color={colors.accent} style={styles.number}>
            {formatCount(celebration.days)}
          </AppText>
          <AppText variant="headline" style={styles.center}>
            {t('streak.celebration.inARow', { count: celebration.days })}
          </AppText>
        </Animated.View>
        <AppText muted style={styles.center}>
          {text.detail}
        </AppText>
        <View style={styles.overlayActions}>
          <Pressable
            onPress={() => openStreak(close)}
            accessibilityRole="button"
            accessibilityLabel={t('streak.celebration.openLabel')}
            style={({ pressed }) => [styles.action, { backgroundColor: colors.accentSoft, opacity: pressed ? 0.7 : 1 }]}
          >
            <AppText variant="label" color={colors.accent}>
              {t('streak.celebration.open')}
            </AppText>
          </Pressable>
          <Pressable
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel={t('streak.celebration.close')}
            style={({ pressed }) => [styles.action, { backgroundColor: colors.accent, opacity: pressed ? 0.7 : 1 }]}
          >
            <AppText variant="label" color={colors.textOnAccent}>
              {t('streak.celebration.close')}
            </AppText>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

/** One spark flying out from behind the number, each on its own angle, distance and colour. */
function Particle({ index, burst }: { index: number; burst: SharedValue<number> }) {
  const angle = (index / PARTICLES) * Math.PI * 2;
  const reach = 90 + (index % 3) * 28;
  const color = SPARK_COLORS[index % SPARK_COLORS.length]!;
  const style = useAnimatedStyle(() => {
    const distance = 20 + burst.value * reach;
    return {
      opacity: burst.value === 0 ? 0 : 1 - burst.value,
      transform: [{ translateX: Math.cos(angle) * distance }, { translateY: Math.sin(angle) * distance }, { rotate: `${burst.value * 180}deg` }, { scale: 1 - burst.value * 0.4 }],
    };
  });
  return (
    <Animated.View style={[styles.particle, style]}>
      <Ionicons name={index % 2 === 0 ? 'star' : 'sparkles'} size={12 + (index % 3) * 4} color={color} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bannerWrap: { position: 'absolute', left: spacing.lg, right: spacing.lg },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    overflow: 'hidden',
    padding: spacing.lg,
    elevation: 14,
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  flame: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  bannerText: { flex: 1, gap: 2 },
  close: { width: TOUCH_TARGET, height: TOUCH_TARGET, alignItems: 'center', justifyContent: 'center', marginRight: -spacing.sm, alignSelf: 'flex-start', marginTop: -spacing.sm },
  overlay: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  panel: { alignSelf: 'stretch', alignItems: 'center', gap: spacing.md, borderRadius: radius.lg, padding: spacing.xl, elevation: 18 },
  sparks: { position: 'absolute', top: '40%', left: '50%' },
  particle: { position: 'absolute' },
  number: { fontSize: 96, lineHeight: 104, textAlign: 'center' },
  center: { textAlign: 'center' },
  overlayActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  action: { minHeight: TOUCH_TARGET, paddingHorizontal: spacing.xl, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});
