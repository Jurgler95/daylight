import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedProps, useAnimatedStyle, withTiming, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { AppText } from '@/components/ui';
import { haptics } from '@/lib/haptics';
import type { IconName } from '@/lib/icons';
import { TOUCH_TARGET, radius, spacing } from '@/lib/theme';

import { DAWN } from './dawn';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Long enough to be a decision, short enough not to be a chore. */
export const HOLD_MS = 1400;
const BEAT_MS = 175;
const RING = 30;
const STROKE = 3;
const CIRCUMFERENCE = 2 * Math.PI * (RING - STROKE);

interface Props {
  label: string;
  /** Spoken, since a screen reader user cannot hold: a double tap sets it right away. */
  accessibilityLabel: string;
  icon: IconName;
  /** Not ready yet (no name): a press only calls `onBlocked`, which says what is missing. */
  blocked?: boolean;
  onBlocked?: () => void;
  progress: SharedValue<number>;
  /** Returns false when nothing was set after all (the save failed), so the button can be held again. */
  onComplete: () => boolean | void;
}

/**
 * Press and hold: a ring fills around the icon while the haptics beat, and letting go early lets
 * it run back. With a screen reader on, a double tap completes it at once.
 */
export function HoldButton({ label, accessibilityLabel, icon, blocked, onBlocked, progress, onComplete }: Props) {
  const beat = useRef<ReturnType<typeof setInterval> | null>(null);
  const done = useRef(false);
  const stopBeat = () => {
    if (beat.current) clearInterval(beat.current);
    beat.current = null;
  };
  useEffect(() => stopBeat, []);

  const complete = () => {
    if (done.current) return;
    done.current = true;
    stopBeat();
    // A screen reader's double tap arrives with the ring still empty: fill it, like a finished hold.
    progress.value = withTiming(1, { duration: 320, easing: Easing.out(Easing.quad) });
    haptics.landmark();
    if (onComplete() === false) done.current = false;
  };

  const start = () => {
    if (done.current) return;
    if (blocked) {
      onBlocked?.();
      return;
    }
    stopBeat();
    haptics.hold();
    beat.current = setInterval(haptics.hold, BEAT_MS);
    progress.value = withTiming(1, { duration: HOLD_MS * (1 - progress.value), easing: Easing.inOut(Easing.quad) }, (finished) => {
      if (finished) scheduleOnRN(complete);
    });
  };

  const release = () => {
    stopBeat();
    if (done.current) return;
    cancelAnimation(progress);
    progress.value = withTiming(0, { duration: 320, easing: Easing.out(Easing.quad) });
  };

  const ring = useAnimatedProps(() => ({ strokeDashoffset: CIRCUMFERENCE * (1 - progress.value) }));
  const fill = useAnimatedStyle(() => ({ transform: [{ scale: 0.86 + progress.value * 0.14 }] }));

  return (
    <Pressable
      onPressIn={start}
      onPressOut={release}
      onPress={() => {
        // Only a screen reader's double tap arrives without a press-in that ran the full hold.
        AccessibilityInfo.isScreenReaderEnabled().then((on) => {
          if (on && !blocked) complete();
        });
      }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!blocked }}
      style={[styles.button, { opacity: blocked ? 0.6 : 1 }]}
    >
      <View style={styles.ring}>
        <Svg width={RING * 2} height={RING * 2} style={StyleSheet.absoluteFill}>
          <Circle cx={RING} cy={RING} r={RING - STROKE} stroke={DAWN.fieldLine} strokeWidth={STROKE} fill="none" />
          <AnimatedCircle
            cx={RING}
            cy={RING}
            r={RING - STROKE}
            stroke={DAWN.sun}
            strokeWidth={STROKE}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            animatedProps={ring}
            transform={`rotate(-90 ${RING} ${RING})`}
          />
        </Svg>
        <Animated.View style={[styles.core, fill]}>
          <MaterialCommunityIcons name={icon} size={24} color={DAWN.sky} />
        </Animated.View>
      </View>
      <AppText variant="label" color={DAWN.text}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    alignSelf: 'center',
    minHeight: TOUCH_TARGET,
    paddingVertical: spacing.sm,
    paddingLeft: spacing.sm,
    paddingRight: spacing.xl,
    borderRadius: radius.pill,
    backgroundColor: DAWN.field,
    borderWidth: 1,
    borderColor: DAWN.fieldLine,
  },
  ring: { width: RING * 2, height: RING * 2, alignItems: 'center', justifyContent: 'center' },
  core: {
    width: (RING - STROKE * 2) * 2 - 6,
    height: (RING - STROKE * 2) * 2 - 6,
    borderRadius: RING,
    backgroundColor: DAWN.sun,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
