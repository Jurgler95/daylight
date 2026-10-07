import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DAWN } from '@/components/turning/dawn';
import { HoldButton } from '@/components/turning/HoldButton';
import { INTRO_MS, SunriseScene } from '@/components/turning/SunriseScene';
import { AppText, Button } from '@/components/ui';
import { getDb } from '@/db';
import { hasEntryOn } from '@/db/repositories/entries';
import { createTurningPoint, getTurningPoint, TurningPointLimitError, updateTurningPoint } from '@/db/repositories/turningPoints';
import { formatLong, isDateString, type DateString } from '@/lib/dates';
import { useToday } from '@/lib/dates/useToday';
import { haptics } from '@/lib/haptics';
import { readInsightDays } from '@/lib/insights/useInsights';
import { mutate, useQuery } from '@/lib/store/dataVersion';
import { TOUCH_TARGET, radius, spacing } from '@/lib/theme';
import { roomInYear, TURNING_POINTS_PER_YEAR, yearOf } from '@/lib/turning/rules';
import { readTurningPoints } from '@/lib/turning/useTurningPoints';

/** Scattered once, the same every time: x and y as shares of the sky, and a size. */
const STARS = [
  [0.08, 0.06, 2],
  [0.22, 0.14, 1.5],
  [0.37, 0.04, 1],
  [0.52, 0.11, 2],
  [0.66, 0.03, 1.5],
  [0.81, 0.09, 1],
  [0.93, 0.17, 2],
  [0.14, 0.26, 1],
  [0.44, 0.22, 1.5],
  [0.74, 0.25, 1],
  [0.88, 0.33, 1.5],
  [0.03, 0.38, 1.5],
  [0.29, 0.34, 1],
  [0.6, 0.31, 2],
] as const;

/** The burst around the sun once the turning point is set. */
const BURST_MS = 1400;
/** How long the risen sun stays before the comparison opens. */
const LINGER_MS = 2000;
/** When the parts of the page arrive, after the night fades in. */
const ENTER = {
  head: 350,
  fields: 700,
  scene: 900,
  action: 250 + INTRO_MS,
};

/**
 * `/turning/new?date=YYYY-MM-DD` sets a turning point on a day with an entry; `?id=` edits the title
 * and note of one. The one screen at dawn instead of daylight: the night fades in, the stars come
 * out one by one, the horizon draws out from the day and the sun peeks up. Holding the button
 * raises it; once set, it bursts.
 */
export default function TurningPointScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ date?: string; id?: string }>();
  const today = useToday();
  const existing = useQuery(() => (params.id ? getTurningPoint(getDb(), Number(params.id)) : undefined), [params.id]);
  const date = (existing?.date ?? (params.date && isDateString(params.date) ? params.date : null)) as DateString | null;
  const hasEntry = useQuery(() => !!date && hasEntryOn(getDb(), date), [date]);
  const valid = !!existing || (!!date && date <= today && hasEntry);
  const taken = useQuery(() => readTurningPoints().map((point) => point.date), []);
  const room = date ? roomInYear(taken, date) : 0;
  const already = !existing && !!date && taken.includes(date);
  const days = useQuery(() => readInsightDays(), []);

  const [title, setTitle] = useState(existing?.title ?? '');
  const [note, setNote] = useState(existing?.note ?? '');
  const [set, setSet] = useState(false);
  const [nudged, setNudged] = useState(false);
  const titleRef = useRef<TextInput>(null);
  // The wait between the burst and the comparison; cleared when the page is left first.
  const linger = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (linger.current) clearTimeout(linger.current);
    },
    [],
  );
  const progress = useSharedValue(existing ? 1 : 0);
  const burst = useSharedValue(0);
  const flash = useSharedValue(0);
  const night = useSharedValue(existing ? 0 : 1);
  const shake = useSharedValue(0);
  const ready = title.trim().length > 0;

  useEffect(() => {
    if (!existing) night.value = withTiming(0, { duration: 900, easing: Easing.out(Easing.quad) });
  }, [existing, night]);

  const stars = useAnimatedStyle(() => ({ opacity: interpolate(progress.value, [0, 1], [1, 0.15]) }));
  const warmth = useAnimatedStyle(() => ({ opacity: interpolate(progress.value, [0, 1], [0.15, 1]) }));
  const dark = useAnimatedStyle(() => ({ opacity: night.value }));
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }));
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

  const close = () => router.back();

  /** A hold without a name: the field shakes, takes the focus and says what it wants. */
  const nudge = () => {
    haptics.off();
    setNudged(true);
    shake.value = withSequence(
      withTiming(-10, { duration: 50 }),
      withTiming(10, { duration: 70 }),
      withTiming(-7, { duration: 70 }),
      withTiming(5, { duration: 60 }),
      withTiming(0, { duration: 50 }),
    );
    titleRef.current?.focus();
    AccessibilityInfo.announceForAccessibility(t('turning.nameFirst'));
  };

  /** Returns false when nothing was saved, so the hold button arms itself again. */
  const save = (): boolean => {
    try {
      if (existing) {
        mutate(() => updateTurningPoint(getDb(), existing.id, { title, note }));
        haptics.confirm();
        close();
        return true;
      }
      const created = mutate(() => createTurningPoint(getDb(), { date: date!, title, note }));
      setSet(true);
      flash.value = withSequence(withTiming(0.5, { duration: 120 }), withTiming(0, { duration: 700, easing: Easing.out(Easing.quad) }));
      burst.value = withTiming(1, { duration: BURST_MS, easing: Easing.out(Easing.cubic) });
      linger.current = setTimeout(() => router.replace({ pathname: '/turning/[id]', params: { id: String(created.id) } }), LINGER_MS);
      return true;
    } catch (error) {
      progress.value = 0;
      const message = error instanceof TurningPointLimitError ? t('turning.fullHint', { year: error.year, max: TURNING_POINTS_PER_YEAR }) : error instanceof Error ? error.message : String(error);
      Alert.alert(t('common.error'), message);
      return false;
    }
  };

  const year = date ? yearOf(date) : '';
  // Editing opens on a risen sun, with nothing to wait for.
  const at = (ms: number) => (existing ? 0 : ms);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <LinearGradient colors={[DAWN.sky, DAWN.skyMid, DAWN.skyLow]} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />
      <Animated.View style={[StyleSheet.absoluteFill, warmth]} pointerEvents="none">
        <LinearGradient colors={['rgba(199, 91, 74, 0)', 'rgba(199, 91, 74, 0.35)', 'rgba(255, 193, 94, 0.45)']} locations={[0.3, 0.75, 1]} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, stars]} pointerEvents="none">
        {STARS.map(([x, yShare, size], i) => (
          <Star key={i} index={i} left={x} top={insets.top + yShare * 420} size={size} instant={!!existing} />
        ))}
      </Animated.View>

      <KeyboardAwareScrollView
        bottomOffset={spacing.xl}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xxl }]}
      >
        <Pressable
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          hitSlop={8}
          style={({ pressed }) => [styles.close, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Ionicons name="close" size={24} color={DAWN.text} />
        </Pressable>

        {!valid || !date ? (
          <AppText color={DAWN.text} style={styles.centered}>
            {t('turning.invalid')}
          </AppText>
        ) : (
          <>
            <Animated.View entering={FadeInDown.delay(at(ENTER.head)).duration(700)} style={styles.head}>
              <AppText variant="caption" color={DAWN.sun} style={styles.eyebrow}>
                {t('turning.eyebrow').toUpperCase()}
              </AppText>
              <AppText variant="title" color={DAWN.text} accessibilityRole="header" style={styles.centered}>
                {formatLong(date)}
              </AppText>
              {!existing && (set || !already) ? (
                <AppText variant="caption" color={DAWN.textSoft}>
                  {room > 0 ? t('turning.room', { count: room, year, max: TURNING_POINTS_PER_YEAR }) : t('turning.full', { year, max: TURNING_POINTS_PER_YEAR })}
                </AppText>
              ) : null}
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(at(ENTER.fields)).duration(700)} style={styles.fields}>
              <Animated.View style={[styles.nameBlock, shakeStyle]}>
                <AppText variant="caption" color={DAWN.sun} style={[styles.eyebrow, styles.centered]}>
                  {t('turning.nameLabel').toUpperCase()}
                </AppText>
                <TextInput
                  ref={titleRef}
                  value={title}
                  onChangeText={(text) => {
                    setTitle(text);
                    if (text.trim()) setNudged(false);
                  }}
                  placeholder={t('turning.titlePlaceholder')}
                  placeholderTextColor={DAWN.textSoft}
                  accessibilityLabel={t('turning.titleLabel')}
                  accessibilityHint={t('turning.nameFirst')}
                  maxLength={60}
                  editable={!set}
                  returnKeyType="next"
                  style={[styles.title, { borderBottomColor: ready ? DAWN.fieldLine : DAWN.sun, borderBottomWidth: ready ? 1 : 2 }]}
                />
                {nudged && !ready ? (
                  <Animated.View entering={FadeIn.duration(200)}>
                    <AppText variant="caption" color={DAWN.sun} style={styles.centered}>
                      {t('turning.nameFirst')}
                    </AppText>
                  </Animated.View>
                ) : null}
              </Animated.View>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder={t('turning.notePlaceholder')}
                placeholderTextColor={DAWN.textSoft}
                accessibilityLabel={t('turning.noteLabel')}
                multiline
                editable={!set}
                style={styles.note}
              />
            </Animated.View>

            <Animated.View entering={FadeIn.delay(at(ENTER.scene)).duration(400)}>
              <SunriseScene days={days} date={date} progress={progress} burst={burst} risen={!!existing} />
              <View style={styles.legend} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                <AppText variant="caption" color={DAWN.textSoft}>
                  {t('turning.before')}
                </AppText>
                <AppText variant="caption" color={DAWN.textSoft}>
                  {t('turning.after')}
                </AppText>
              </View>
            </Animated.View>

            {existing ? (
              <Button label={t('turning.save')} disabled={!ready} onPress={save} style={styles.save} />
            ) : set ? (
              <Animated.View entering={ZoomIn.delay(300).springify().damping(14)} style={styles.setBox}>
                <AppText variant="title" color={DAWN.text} style={styles.centered} accessibilityLiveRegion="polite">
                  {t('turning.setTitle')}
                </AppText>
                <AppText color={DAWN.textSoft} style={styles.centered}>
                  {t('turning.set')}
                </AppText>
              </Animated.View>
            ) : already ? (
              <AppText color={DAWN.textSoft} style={styles.centered}>
                {t('turning.already')}
              </AppText>
            ) : room === 0 ? (
              <AppText color={DAWN.textSoft} style={styles.centered}>
                {t('turning.fullHint', { year, max: TURNING_POINTS_PER_YEAR })}
              </AppText>
            ) : (
              <Animated.View entering={FadeInUp.delay(ENTER.action).duration(600)} style={styles.action}>
                <HoldButton
                  label={t('turning.hold')}
                  accessibilityLabel={t('turning.holdA11y')}
                  icon="flag-variant"
                  blocked={!ready}
                  onBlocked={nudge}
                  progress={progress}
                  onComplete={save}
                />
                <AppText variant="caption" color={DAWN.textSoft} style={styles.centered}>
                  {t('turning.explain')}
                </AppText>
              </Animated.View>
            )}
          </>
        )}
      </KeyboardAwareScrollView>

      {/* The night the page opens from, and the flash when the sun bursts. Neither takes touches. */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.night, dark]} pointerEvents="none" />
      <Animated.View style={[StyleSheet.absoluteFill, styles.flash, flashStyle]} pointerEvents="none" />
    </View>
  );
}

/** A star that comes out after the ones before it, then twinkles on its own beat. */
function Star({ index, left, top, size, instant }: { index: number; left: number; top: number; size: number; instant: boolean }) {
  const light = useSharedValue(instant ? 1 : 0);
  useEffect(() => {
    const twinkle = withRepeat(
      withSequence(withTiming(0.35, { duration: 1100 + (index % 4) * 350 }), withTiming(1, { duration: 1100 + (index % 3) * 400 })),
      -1,
      false,
    );
    light.value = instant ? twinkle : withDelay(500 + index * 110, withSequence(withTiming(1, { duration: 500 }), twinkle));
  }, [index, instant, light]);
  const style = useAnimatedStyle(() => ({ opacity: light.value, transform: [{ scale: 0.6 + light.value * 0.4 }] }));
  return <Animated.View style={[styles.star, { left: `${left * 100}%`, top, width: size * 2, height: size * 2, borderRadius: size }, style]} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: DAWN.sky },
  content: { paddingHorizontal: spacing.lg, gap: spacing.xl },
  close: {
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DAWN.field,
  },
  star: { position: 'absolute', backgroundColor: DAWN.star },
  head: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg },
  eyebrow: { letterSpacing: 3 },
  centered: { textAlign: 'center' },
  fields: { gap: spacing.lg },
  nameBlock: { gap: spacing.xs },
  title: {
    color: DAWN.text,
    fontSize: 26,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  note: {
    color: DAWN.text,
    fontSize: 16,
    minHeight: TOUCH_TARGET * 1.5,
    textAlignVertical: 'top',
    padding: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: DAWN.field,
  },
  legend: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs },
  action: { gap: spacing.md },
  save: { alignSelf: 'stretch' },
  setBox: { minHeight: TOUCH_TARGET * 2, justifyContent: 'center', gap: spacing.xs },
  night: { backgroundColor: '#03060F' },
  flash: { backgroundColor: '#FFF1CC' },
});
