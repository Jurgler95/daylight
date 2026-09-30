import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeInDown, interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { AppText } from '@/components/ui';
import { haptics } from '@/lib/haptics';
import { TOUCH_TARGET, spacing, useTheme } from '@/lib/theme';

interface Props {
  label: string;
  min: number;
  max: number;
  value: number | null;
  /** "3 von 5". */
  valueLabel: (value: number) => string;
  /** Shown while no value is set. */
  emptyLabel: string;
  onChange: (value: number | null) => void;
}

/**
 * A scale as a row of rising bars (from Zyklus). Tap a bar or slide across them; every step ticks
 * under the finger and the value is taken when the finger lifts. Tapping the set value clears it.
 */
export function ScaleInput({ label, min, max, value, valueLabel, emptyLabel, onChange }: Props) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const [preview, setPreview] = useState<number | null>(null);
  const lastTick = useRef<number | null>(null);
  const shown = preview ?? value;
  const steps = Array.from({ length: max - min + 1 }, (_, i) => min + i);

  const stepAt = (x: number) => min + Math.min(max - min, Math.max(0, Math.floor((x / Math.max(1, width)) * steps.length)));

  const follow = (x: number) => {
    const step = stepAt(x);
    if (lastTick.current !== step) haptics.tick();
    lastTick.current = step;
    setPreview(step);
  };

  const pan = Gesture.Pan()
    .runOnJS(true)
    // Horizontal slides belong to the scale, vertical ones still scroll the editor.
    .activeOffsetX([-6, 6])
    .failOffsetY([-12, 12])
    .onStart((event) => follow(event.x))
    .onUpdate((event) => follow(event.x))
    .onEnd((event) => {
      const step = stepAt(event.x);
      if (step !== value) {
        haptics.on();
        onChange(step);
      }
    })
    .onFinalize(() => {
      lastTick.current = null;
      setPreview(null);
    });

  const tap = Gesture.Tap()
    .runOnJS(true)
    .onEnd((event) => {
      const step = stepAt(event.x);
      if (step === value) {
        haptics.off();
        onChange(null);
      } else {
        haptics.on();
        onChange(step);
      }
    });

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <AppText variant="label">{label}</AppText>
        <Animated.View key={String(shown)} entering={FadeInDown.duration(90)}>
          <AppText variant="label" color={shown === null ? colors.textMuted : colors.accent}>
            {shown === null ? emptyLabel : valueLabel(shown)}
          </AppText>
        </Animated.View>
      </View>
      <GestureDetector gesture={Gesture.Race(pan, tap)}>
        <View
          onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={label}
          accessibilityValue={{ min, max, now: value ?? undefined, text: value === null ? emptyLabel : valueLabel(value) }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === 'increment') onChange(value === null ? min : Math.min(max, value + 1));
            if (event.nativeEvent.actionName === 'decrement') onChange(value === null || value <= min ? null : value - 1);
          }}
          style={styles.bars}
        >
          {steps.map((step) => (
            <Bar key={step} rank={(step - min) / Math.max(1, max - min)} filled={shown !== null && step <= shown} current={step === shown} />
          ))}
        </View>
      </GestureDetector>
      <View style={styles.ends}>
        <AppText variant="caption" muted>
          {min}
        </AppText>
        <AppText variant="caption" muted>
          {max}
        </AppText>
      </View>
    </View>
  );
}

function Bar({ rank, filled, current }: { rank: number; filled: boolean; current: boolean }) {
  const { colors } = useTheme();
  const fill = useSharedValue(filled ? 1 : 0);
  const lift = useSharedValue(current ? 1 : 0);

  useEffect(() => {
    // A short delay per bar lets the colour run up the scale like a level meter.
    fill.value = withTiming(filled ? 1 : 0, { duration: 50 + rank * 50 });
    lift.value = withTiming(current ? 1 : 0, { duration: 80 });
  }, [filled, current, rank, fill, lift]);

  const animated = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(fill.value, [0, 1], [colors.surfaceMuted, colors.accent]),
    transform: [{ scaleY: 1 + lift.value * 0.12 }],
  }));

  return <Animated.View style={[styles.bar, { height: BAR_MIN + rank * (TOUCH_TARGET - BAR_MIN) }, animated]} />;
}

const BAR_MIN = 14;

const styles = StyleSheet.create({
  root: { gap: spacing.sm },
  header: { flexDirection: 'row', justifyContent: 'space-between' },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: TOUCH_TARGET + 8, paddingTop: 8 },
  bar: { flex: 1, borderRadius: 6, transformOrigin: 'bottom' },
  ends: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -spacing.xs },
});
