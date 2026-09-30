import { Ionicons } from '@expo/vector-icons';
import { useLayoutEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { haptics } from '@/lib/haptics';
import { TOUCH_TARGET, radius, useTheme } from '@/lib/theme';

interface Props<T> {
  items: readonly T[];
  keyOf: (item: T) => number;
  /** Fixed, so the drop position follows from the drag distance without measuring. */
  rowHeight: number;
  renderRow: (item: T) => ReactNode;
  onReorder: (orderedIds: number[]) => void;
  /** "Müde verschieben", on the handle. */
  handleLabel: (item: T) => string;
  moveUpLabel: string;
  moveDownLabel: string;
}

/** Hold before the drag starts, so a swipe over the handle still scrolls the page. */
const HOLD_MS = 180;
const SETTLE = { duration: 120 };

/**
 * A list that is reordered by holding the handle and dragging. Screen readers get "nach oben" and
 * "nach unten" actions on the handle instead, which also serve anyone who cannot drag.
 */
export function SortableList<T>({ items, keyOf, rowHeight, renderRow, onReorder, handleLabel, moveUpLabel, moveDownLabel }: Props<T>) {
  const dragging = useSharedValue(-1);
  const offset = useSharedValue(0);
  const ids = items.map(keyOf);
  const order = ids.join(',');

  // The new order has arrived: every row now sits in its place, so the drag shifts are dropped.
  useLayoutEffect(() => {
    dragging.value = -1;
    offset.value = 0;
  }, [order, dragging, offset]);

  const move = (from: number, to: number) => {
    const next = [...ids];
    const [moved] = next.splice(from, 1);
    if (moved === undefined || from === to) {
      dragging.value = -1;
      offset.value = 0;
      return;
    }
    next.splice(to, 0, moved);
    haptics.on();
    onReorder(next);
  };

  return (
    <View style={{ height: items.length * rowHeight }}>
      {items.map((item, index) => (
        <SortableRow
          key={keyOf(item)}
          index={index}
          count={items.length}
          rowHeight={rowHeight}
          dragging={dragging}
          offset={offset}
          onDrop={move}
          handleLabel={handleLabel(item)}
          moveUpLabel={moveUpLabel}
          moveDownLabel={moveDownLabel}
        >
          {renderRow(item)}
        </SortableRow>
      ))}
    </View>
  );
}

interface RowProps {
  index: number;
  count: number;
  rowHeight: number;
  dragging: SharedValue<number>;
  offset: SharedValue<number>;
  onDrop: (from: number, to: number) => void;
  handleLabel: string;
  moveUpLabel: string;
  moveDownLabel: string;
  children: ReactNode;
}

function clamp(value: number, min: number, max: number): number {
  'worklet';
  return Math.min(max, Math.max(min, value));
}

function SortableRow({ index, count, rowHeight, dragging, offset, onDrop, handleLabel, moveUpLabel, moveDownLabel, children }: RowProps) {
  const { colors } = useTheme();

  const pan = Gesture.Pan()
    .activateAfterLongPress(HOLD_MS)
    .onStart(() => {
      dragging.value = index;
      offset.value = 0;
      scheduleOnRN(haptics.tick);
    })
    .onUpdate((event) => {
      offset.value = clamp(event.translationY, -index * rowHeight, (count - 1 - index) * rowHeight);
    })
    .onEnd(() => {
      const to = clamp(index + Math.round(offset.value / rowHeight), 0, count - 1);
      if (to === index) {
        offset.value = withTiming(0, SETTLE, () => {
          dragging.value = -1;
        });
        return;
      }
      // Snap onto the slot; the rows are re-laid out in their new order once it is saved.
      offset.value = withTiming((to - index) * rowHeight, SETTLE);
      scheduleOnRN(onDrop, index, to);
    })
    .onFinalize((_, success) => {
      // Interrupted by the system (a call, the app going to the background): put the row back.
      if (!success && dragging.value === index) {
        dragging.value = -1;
        offset.value = 0;
      }
    });

  const animated = useAnimatedStyle(() => {
    const active = dragging.value;
    if (active === -1) return { transform: [{ translateY: 0 }], zIndex: 0, elevation: 0 };
    if (active === index) return { transform: [{ translateY: offset.value }], zIndex: 10, elevation: 6 };
    const target = clamp(active + Math.round(offset.value / rowHeight), 0, count - 1);
    const shift = active < index && index <= target ? -rowHeight : target <= index && index < active ? rowHeight : 0;
    return { transform: [{ translateY: withTiming(shift, SETTLE) }], zIndex: 0, elevation: 0 };
  });

  return (
    <Animated.View style={[styles.row, { height: rowHeight, backgroundColor: colors.surface }, animated]}>
      <GestureDetector gesture={pan}>
        <View
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={handleLabel}
          accessibilityActions={[
            ...(index > 0 ? [{ name: 'decrement', label: moveUpLabel }] : []),
            ...(index < count - 1 ? [{ name: 'increment', label: moveDownLabel }] : []),
          ]}
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === 'decrement') onDrop(index, index - 1);
            if (event.nativeEvent.actionName === 'increment') onDrop(index, index + 1);
          }}
          style={styles.handle}
        >
          <Ionicons name="reorder-three" size={24} color={colors.textMuted} />
        </View>
      </GestureDetector>
      <View style={styles.content}>{children}</View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.sm },
  handle: { width: TOUCH_TARGET, height: TOUCH_TARGET, alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1 },
});
