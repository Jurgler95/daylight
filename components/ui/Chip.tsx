import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { haptics } from '@/lib/haptics';
import type { IconName } from '@/lib/icons';
import { TOUCH_TARGET, radius, spacing, useTheme } from '@/lib/theme';

import { AppText } from './AppText';
import { PressableScale } from './PressableScale';

interface Props {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  color?: string;
  /** Activity icon in front of the label. */
  icon?: IconName;
}

/** Colour fades in, then the chip gives a small hop, so picking one feels like it landed. */
export function Chip({ label, selected, onPress, color, icon }: Props) {
  const { colors } = useTheme();
  const tint = color ?? colors.accent;
  const progress = useSharedValue(selected ? 1 : 0);
  const pop = useSharedValue(1);
  const first = useRef(true);

  useEffect(() => {
    progress.value = withTiming(selected ? 1 : 0, { duration: 90 });
    // No hop on first render, only when the selection actually changes under the finger.
    if (first.current) {
      first.current = false;
      return;
    }
    if (selected) pop.value = withSequence(withTiming(1.05, { duration: 60 }), withTiming(1, { duration: 90 }));
  }, [selected, progress, pop]);

  const animated = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [colors.surfaceMuted, tint]),
    transform: [{ scale: pop.value }],
  }));

  return (
    <PressableScale
      onPress={
        onPress
          ? () => {
              if (selected) haptics.off();
              else haptics.on();
              onPress();
            }
          : undefined
      }
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!selected }}
    >
      <Animated.View style={[styles.chip, animated]}>
        {icon ? <MaterialCommunityIcons name={icon} size={18} color={selected ? colors.textOnAccent : colors.text} /> : null}
        <AppText variant="label" color={selected ? colors.textOnAccent : colors.text}>
          {label}
        </AppText>
      </Animated.View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: TOUCH_TARGET,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
});
