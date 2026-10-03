import { Ionicons } from '@expo/vector-icons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeOutUp,
  SlideInUp,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui';
import { TIER_COUNT, type Achievement, type StarNews } from '@/lib/achievements';
import { ACHIEVEMENTS_PATH, useStarNews } from '@/lib/achievements/useStarNews';
import { haptics } from '@/lib/haptics';
import { formatCount } from '@/lib/insights';
import { radius, spacing, TOUCH_TARGET, useTheme, withAlpha } from '@/lib/theme';

import { STAR_COLOR, TierStar } from './StarRow';

/** How long the message stays before it counts as seen and slides away. */
export const TOAST_MS = 8000;
/** Wait before it flies in, so on opening the app it does not just sit there when the first screen appears. */
export const TOAST_DELAY_MS = 700;
/** Gold medal behind the trophy; decorative, the words carry the news. */
const MEDAL = ['#FFD54A', '#E09B00'] as const;
const SPARKS = 8;

/**
 * Slides in from the top when stars were earned, wherever the app is, except over an open entry
 * and on the achievements tab itself. A tap opens the achievements; the cross or the timer put it
 * away. Either way the stars count as announced.
 */
export function StarToast() {
  const { news, acknowledge } = useStarNews();
  // Keyed by its content, so a second batch of stars starts its own entrance and timer.
  const key = news ? (news.kind === 'welcome' ? 'welcome' : news.earned.map(({ achievement }) => `${achievement.key}${achievement.stars}`).join()) : null;
  return news && key ? (
    <Delayed key={key}>
      <Toast news={news} acknowledge={acknowledge} />
    </Delayed>
  ) : null;
}

/** Renders its child only after `TOAST_DELAY_MS`, so the entrance, the buzz and the timer all start then. */
function Delayed({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const timeout = setTimeout(() => setReady(true), TOAST_DELAY_MS);
    return () => clearTimeout(timeout);
  }, []);
  return ready ? children : null;
}

function Toast({ news, acknowledge }: { news: StarNews; acknowledge: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const timer = useSharedValue(1);
  const done = useRef(false);

  const close = () => {
    if (done.current) return;
    done.current = true;
    acknowledge();
  };
  const open = () => {
    haptics.tap();
    close();
    router.navigate(ACHIEVEMENTS_PATH);
  };

  useEffect(() => {
    haptics.confirm();
    timer.value = withTiming(0, { duration: TOAST_MS, easing: Easing.linear });
    const timeout = setTimeout(close, TOAST_MS);
    return () => clearTimeout(timeout);
    // Runs once per message; `close` only reads a ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const bar = useAnimatedStyle(() => ({ width: `${timer.value * 100}%` }));

  const text = describe(news, t);

  return (
    <Animated.View
      entering={SlideInUp.springify().damping(17).stiffness(320).mass(0.8)}
      exiting={FadeOutUp.duration(140)}
      style={[styles.wrap, { top: insets.top + spacing.sm }]}
    >
      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={`${text.eyebrow}. ${text.title}. ${text.detail}. ${t('achievements.toast.open')}`}
        accessibilityLiveRegion="polite"
        style={({ pressed }) => [styles.card, { backgroundColor: colors.surface, borderColor: withAlpha(STAR_COLOR, 0.35), shadowColor: STAR_COLOR, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
      >
        <LinearGradient colors={['#FFF4CC', colors.surface]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <View style={styles.row}>
          <Medal />
          <View style={styles.text}>
            <AppText variant="caption" color={STAR_COLOR}>
              {text.eyebrow.toUpperCase()}
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
              close();
            }}
            accessibilityRole="button"
            accessibilityLabel={t('achievements.toast.close')}
            hitSlop={8}
            style={({ pressed }) => [styles.close, { opacity: pressed ? 0.5 : 1 }]}
          >
            <Ionicons name="close" size={20} color={colors.textMuted} />
          </Pressable>
        </View>
        <View style={styles.footer}>
          {news.kind === 'welcome' ? (
            <View />
          ) : news.earned.length === 1 ? (
            <PopStars achievement={news.earned[0]!.achievement} from={news.earned[0]!.from} />
          ) : (
            <PopBadges achievements={news.earned.map(({ achievement }) => achievement)} />
          )}
          <View style={[styles.open, { backgroundColor: colors.accent }]}>
            <AppText variant="label" color={colors.textOnAccent}>
              {t('achievements.toast.open')}
            </AppText>
            <Ionicons name="chevron-forward" size={16} color={colors.textOnAccent} />
          </View>
        </View>
        <View style={[styles.track, { backgroundColor: withAlpha(STAR_COLOR, 0.15) }]}>
          <Animated.View style={[styles.bar, { backgroundColor: STAR_COLOR }, bar]} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

type T = ReturnType<typeof useTranslation>['t'];

function describe(news: StarNews, t: T): { eyebrow: string; title: string; detail: string } {
  if (news.kind === 'welcome') {
    return { eyebrow: t('achievements.toast.welcomeEyebrow'), title: t('achievements.title'), detail: t('achievements.toast.welcome', { stars: formatCount(news.stars) }) };
  }
  const [first, ...rest] = news.earned;
  const { achievement } = first!;
  if (rest.length === 0) {
    const title = t(`achievements.items.${achievement.key}.title`);
    const reached = achievement.tiers[achievement.stars - 1]!;
    const amount = t(`achievements.units.${achievement.unit}`, { count: reached, value: formatCount(reached) });
    return {
      eyebrow: achievement.stars === TIER_COUNT ? t('achievements.toast.allFive') : t('achievements.toast.newStars', { count: news.count }),
      title,
      detail: `${t('achievements.toast.reached', { value: amount })} · ${t(`achievements.items.${achievement.key}.text`)}`,
    };
  }
  const names = news.earned.slice(0, 3).map(({ achievement: a }) => t(`achievements.items.${a.key}.title`));
  const more = news.earned.length - names.length;
  return {
    eyebrow: t('achievements.toast.newStars', { count: news.count }),
    title: t('achievements.toast.across', { count: news.earned.length }),
    detail: more > 0 ? `${names.join(', ')} ${t('achievements.toast.more', { count: more })}` : names.join(', '),
  };
}

/** The trophy on a gold medal, with a slight sway and a soft ring of sparks once it has settled. */
function Medal() {
  const burst = useSharedValue(0);
  const tilt = useSharedValue(0);
  useEffect(() => {
    burst.value = withDelay(150, withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) }));
    tilt.value = withDelay(120, withSequence(withTiming(-6, { duration: 80 }), withTiming(4, { duration: 90 }), withTiming(0, { duration: 100 })));
  }, [burst, tilt]);
  const medal = useAnimatedStyle(() => ({ transform: [{ rotate: `${tilt.value}deg` }] }));
  return (
    <View style={styles.medalBox} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {Array.from({ length: SPARKS }, (_, index) => (
        <Spark key={index} angle={(index / SPARKS) * Math.PI * 2} burst={burst} />
      ))}
      <Animated.View style={medal}>
        <LinearGradient colors={MEDAL} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.medal}>
          <MaterialCommunityIcons name="trophy" size={28} color="#FFFFFF" />
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

function Spark({ angle, burst }: { angle: number; burst: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const distance = 20 + burst.value * 12;
    return {
      opacity: burst.value === 0 ? 0 : (1 - burst.value) * 0.8,
      transform: [{ translateX: Math.cos(angle) * distance }, { translateY: Math.sin(angle) * distance }, { scale: 1 - burst.value * 0.5 }],
    };
  });
  return (
    <Animated.View style={[styles.spark, style]}>
      <MaterialCommunityIcons name="star-four-points" size={10} color={STAR_COLOR} />
    </Animated.View>
  );
}

/** The achievement's five stars; the ones just earned pop in one after the other. */
function PopStars({ achievement, from }: { achievement: Achievement; from: number }) {
  return (
    <View style={styles.stars} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {Array.from({ length: TIER_COUNT }, (_, index) => (
        <PopStar key={index} index={index} earned={index < achievement.stars} fresh={index >= from && index < achievement.stars} delay={180 + (index - from) * 70} />
      ))}
    </View>
  );
}

const BADGES = 5;

/** With stars in several achievements: their icons pop in one after the other, the rest as "+n". */
function PopBadges({ achievements }: { achievements: readonly Achievement[] }) {
  const { colors } = useTheme();
  const shown = achievements.slice(0, BADGES);
  const rest = achievements.length - shown.length;
  return (
    <View style={styles.badges} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {shown.map((achievement, index) => (
        <PopBadge key={achievement.key} icon={achievement.icon} delay={180 + index * 60} ring={colors.surface} />
      ))}
      {rest > 0 ? (
        <AppText variant="caption" color={STAR_COLOR} style={styles.rest}>
          {`+${rest}`}
        </AppText>
      ) : null}
    </View>
  );
}

function PopBadge({ icon, delay, ring }: { icon: Achievement['icon']; delay: number; ring: string }) {
  const scale = useSharedValue(0);
  useEffect(() => {
    scale.value = withDelay(delay, withSequence(withTiming(1.1, { duration: 110, easing: Easing.out(Easing.cubic) }), withTiming(1, { duration: 80 })));
  }, [delay, scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={[styles.badge, { borderColor: ring }, style]}>
      <LinearGradient colors={MEDAL} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.badgeFill}>
        <MaterialCommunityIcons name={icon} size={15} color="#FFFFFF" />
      </LinearGradient>
    </Animated.View>
  );
}

function PopStar({ index, earned, fresh, delay }: { index: number; earned: boolean; fresh: boolean; delay: number }) {
  const scale = useSharedValue(fresh ? 0 : 1);
  useEffect(() => {
    if (fresh) scale.value = withDelay(delay, withSequence(withTiming(1.15, { duration: 120, easing: Easing.out(Easing.cubic) }), withTiming(1, { duration: 90 })));
  }, [fresh, delay, scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <View>
      {fresh ? (
        <View style={StyleSheet.absoluteFill}>
          <TierStar index={index} earned={false} size={STAR_SIZE} />
        </View>
      ) : null}
      <Animated.View style={style}>
        <TierStar index={index} earned={earned} size={STAR_SIZE} />
      </Animated.View>
    </View>
  );
}

const STAR_SIZE = 18;

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: spacing.lg, right: spacing.lg },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1.5,
    overflow: 'hidden',
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    elevation: 14,
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  text: { flex: 1, gap: 2 },
  medalBox: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  medal: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  spark: { position: 'absolute' },
  close: { width: TOUCH_TARGET, height: TOUCH_TARGET, alignItems: 'center', justifyContent: 'center', marginRight: -spacing.sm, alignSelf: 'flex-start', marginTop: -spacing.sm },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stars: { flexDirection: 'row', gap: 2 },
  badges: { flexDirection: 'row', alignItems: 'center' },
  badge: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, marginRight: -6, overflow: 'hidden' },
  badgeFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  rest: { marginLeft: spacing.md },
  open: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill },
  track: { height: 4, marginHorizontal: -spacing.lg },
  bar: { height: '100%' },
});
