import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

const MAX_SCALE = 5;
const DOUBLE_TAP_SCALE = 2.5;

interface Props {
  children: ReactNode;
}

/**
 * Pinch to zoom, drag to move while zoomed, double tap to zoom in or back out. Zooming keeps the point
 * under the fingers in place, and the content never slides further than its own edges.
 */
export function ZoomableView({ children }: Props) {
  const width = useSharedValue(0);
  const height = useSharedValue(0);
  const scale = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const start = useSharedValue({ scale: 1, x: 0, y: 0, focalX: 0, focalY: 0 });

  const limit = (value: number, size: number, s: number) => {
    'worklet';
    const max = (size * (s - 1)) / 2;
    return Math.min(max, Math.max(-max, value));
  };

  const settle = () => {
    'worklet';
    const s = Math.min(MAX_SCALE, Math.max(1, scale.value));
    scale.value = withTiming(s);
    x.value = withTiming(limit(x.value, width.value, s));
    y.value = withTiming(limit(y.value, height.value, s));
  };

  const remember = () => {
    'worklet';
    start.value = { ...start.value, scale: scale.value, x: x.value, y: y.value };
  };

  const pinch = Gesture.Pinch()
    .onStart((e) => {
      remember();
      start.value = { ...start.value, focalX: e.focalX - width.value / 2, focalY: e.focalY - height.value / 2 };
    })
    .onUpdate((e) => {
      const s = Math.min(MAX_SCALE * 1.2, Math.max(0.8, start.value.scale * e.scale));
      const ratio = s / start.value.scale;
      scale.value = s;
      x.value = start.value.focalX - (start.value.focalX - start.value.x) * ratio;
      y.value = start.value.focalY - (start.value.focalY - start.value.y) * ratio;
    })
    .onEnd(settle);

  const pan = Gesture.Pan()
    .averageTouches(true)
    .onStart(remember)
    .onUpdate((e) => {
      if (scale.value <= 1) return;
      x.value = start.value.x + e.translationX;
      y.value = start.value.y + e.translationY;
    })
    .onEnd(settle);

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((e) => {
      if (scale.value > 1) {
        scale.value = withTiming(1);
        x.value = withTiming(0);
        y.value = withTiming(0);
        return;
      }
      const s = DOUBLE_TAP_SCALE;
      const focalX = e.x - width.value / 2;
      const focalY = e.y - height.value / 2;
      scale.value = withTiming(s);
      x.value = withTiming(limit(-focalX * (s - 1), width.value, s));
      y.value = withTiming(limit(-focalY * (s - 1), height.value, s));
    });

  const gesture = Gesture.Race(doubleTap, Gesture.Simultaneous(pinch, pan));

  const animated = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }, { scale: scale.value }],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <View
        style={styles.flex}
        collapsable={false}
        onLayout={(e) => {
          width.value = e.nativeEvent.layout.width;
          height.value = e.nativeEvent.layout.height;
        }}
      >
        <Animated.View style={[styles.flex, animated]}>{children}</Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
