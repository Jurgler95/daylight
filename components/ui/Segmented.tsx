import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { haptics } from '@/lib/haptics';
import { TOUCH_TARGET, radius, spacing, useTheme } from '@/lib/theme';

import { AppText } from './AppText';

interface Option<T> {
  value: T;
  label: string;
}

interface Props<T> {
  /** Sits above the track and says what is being switched. */
  label?: string;
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
}

const SLIDE = { damping: 18, stiffness: 220, mass: 0.7 };

/**
 * A two or three way switch in one connected track. Unlike a row of chips it reads as
 * "pick one of these", which is why it carries switches and never actions.
 * The highlight slides over to the picked segment instead of jumping.
 */
export function Segmented<T extends string | number>({ label, options, value, onChange }: Props<T>) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((option) => option.value === value));
  const segment = width > 0 ? (width - PADDING * 2) / options.length : 0;
  const offset = useSharedValue(index * segment);

  useEffect(() => {
    offset.value = withSpring(index * segment, SLIDE);
  }, [index, segment, offset]);

  const indicator = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value }] }));

  return (
    <View style={styles.wrap}>
      {label ? (
        <AppText variant="caption" muted>
          {label}
        </AppText>
      ) : null}
      <View
        accessibilityRole="radiogroup"
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        style={[styles.track, { backgroundColor: colors.surfaceMuted }]}
      >
        {segment > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[styles.indicator, { width: segment, backgroundColor: colors.accent }, indicator]}
          />
        ) : null}
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={String(option.value)}
              onPress={() => {
                if (!selected) haptics.tick();
                onChange(option.value);
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={option.label}
              style={({ pressed }) => [
                styles.segment,
                // Until the track is measured there is no sliding highlight, so fall back to a plain fill.
                selected && segment === 0 && { backgroundColor: colors.accent },
                { opacity: pressed && !selected ? 0.6 : 1 },
              ]}
            >
              <AppText variant="label" color={selected ? colors.textOnAccent : colors.text} numberOfLines={1}>
                {option.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const PADDING = 3;

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  track: { flexDirection: 'row', borderRadius: radius.pill, padding: PADDING },
  indicator: { position: 'absolute', top: PADDING, bottom: PADDING, left: PADDING, borderRadius: radius.pill },
  segment: {
    flex: 1,
    minHeight: TOUCH_TARGET - PADDING * 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
