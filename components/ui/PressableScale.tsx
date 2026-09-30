import type { Ref } from 'react';
import { Pressable, type PressableProps, type StyleProp, type View, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Short and firm: the press registers at once and lets go before the next tap. */
const DOWN = { duration: 60, easing: Easing.out(Easing.quad) };
const UP = { duration: 110, easing: Easing.out(Easing.quad) };

interface Props extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  /** How far the element sinks while held, 0.97 by default. */
  pressedScale?: number;
  ref?: Ref<View>;
}

/**
 * A Pressable that sinks a little under the finger and springs back on release.
 * Every tappable surface in the app uses it, so touch always answers the same way.
 */
export function PressableScale({ style, pressedScale = 0.97, onPressIn, onPressOut, ...rest }: Props) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(event) => {
        scale.value = withTiming(pressedScale, DOWN);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        scale.value = withTiming(1, UP);
        onPressOut?.(event);
      }}
      style={[style, animated]}
    />
  );
}
