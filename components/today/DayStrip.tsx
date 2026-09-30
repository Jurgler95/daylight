import { memo, useCallback, useImperativeHandle, useMemo, useRef, type Ref } from 'react';
import { FlatList, Pressable, StyleSheet, useWindowDimensions } from 'react-native';

import { DayGlyph } from '@/components/calendar/DayGlyph';
import { AppText } from '@/components/ui';
import { haptics } from '@/lib/haptics';
import type { CalendarMarker } from '@/lib/calendar/dayLabel';
import { addDaysToDateString, daysBetween, formatWeekdayShort, type DateString } from '@/lib/dates';
import { radius, spacing, useTheme } from '@/lib/theme';

/**
 * How far the strip reaches back. Far enough to feel endless while scrolling; the calendar is the
 * way to anything older.
 */
export const STRIP_RADIUS_DAYS = 365;
/** How far it reaches ahead. Enough for the coming week and planning in phase 4. */
export const STRIP_AHEAD_DAYS = 30;

/** Fixed so the list can be virtualised and snapped without measuring. */
const ITEM_WIDTH = 52;

export interface DayStripHandle {
  scrollToDate: (date: DateString) => void;
}

interface Props {
  today: DateString;
  selected: DateString;
  markers: ReadonlyMap<string, CalendarMarker>;
  label: (date: DateString) => string;
  onSelect: (date: DateString) => void;
  ref?: Ref<DayStripHandle>;
}

/**
 * A horizontal wheel of days around today.
 * Flings coast on and settle on a whole day; tapping one selects it for the screen below.
 */
export function DayStrip({ today, selected, markers, label, onSelect, ref }: Props) {
  const list = useRef<FlatList<DateString>>(null);
  const { width } = useWindowDimensions();

  const days = useMemo(
    () => Array.from({ length: STRIP_RADIUS_DAYS + STRIP_AHEAD_DAYS + 1 }, (_, i) => addDaysToDateString(today, i - STRIP_RADIUS_DAYS)),
    [today],
  );

  // Scrolling by index aligns a day to the left edge, so aim that many days before the
  // one we want in order to leave it roughly in the middle of the screen.
  const leading = Math.max(0, Math.floor((Math.floor(width / ITEM_WIDTH) - 1) / 2));
  const offsetIndexOf = useCallback(
    (date: DateString) => {
      const index = STRIP_RADIUS_DAYS + daysBetween(today, date) - leading;
      return Math.min(days.length - 1, Math.max(0, index));
    },
    [today, leading, days.length],
  );

  useImperativeHandle(
    ref,
    () => ({ scrollToDate: (date) => list.current?.scrollToIndex({ index: offsetIndexOf(date), animated: true }) }),
    [offsetIndexOf],
  );

  return (
    <FlatList
      ref={list}
      data={days}
      horizontal
      keyExtractor={(date) => date}
      extraData={[selected, markers]}
      renderItem={({ item }) => (
        <StripDay
          date={item}
          marker={markers.get(item)}
          isToday={item === today}
          isFuture={item > today}
          selected={item === selected}
          label={label(item)}
          onSelect={onSelect}
        />
      )}
      getItemLayout={(_, index) => ({ length: ITEM_WIDTH, offset: ITEM_WIDTH * index, index })}
      // The selected day, not today: the calendar can open the tab on any day.
      initialScrollIndex={offsetIndexOf(selected)}
      onScrollToIndexFailed={() => undefined}
      showsHorizontalScrollIndicator={false}
      // A fling keeps rolling and only then settles on a whole day, like a wheel.
      decelerationRate="normal"
      snapToInterval={ITEM_WIDTH}
      snapToAlignment="start"
      initialNumToRender={12}
      maxToRenderPerBatch={12}
      windowSize={5}
      style={styles.list}
    />
  );
}

interface DayProps {
  date: DateString;
  marker: CalendarMarker | undefined;
  isToday: boolean;
  isFuture: boolean;
  selected: boolean;
  label: string;
  onSelect: (date: DateString) => void;
}

/** Memoised, so picking a day only redraws the two days whose selection changed. */
const StripDay = memo(function StripDay({ date, marker, isToday, isFuture, selected, label, onSelect }: DayProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => {
        if (!selected) haptics.tick();
        onSelect(date);
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.day,
        {
          // The box marks the selection, the ring inside marks today; they never mean the same thing.
          borderColor: selected ? colors.accent : 'transparent',
          backgroundColor: selected ? colors.surface : 'transparent',
          opacity: pressed ? 0.6 : 1,
        },
      ]}
    >
      <AppText variant="caption" color={selected ? colors.accent : colors.textMuted}>
        {formatWeekdayShort(date)}
      </AppText>
      <DayGlyph marker={marker} isToday={isToday} isFuture={isFuture} dayOfMonth={Number(date.slice(8, 10))} />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  list: { flexGrow: 0 },
  day: {
    width: ITEM_WIDTH,
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderWidth: 1.5,
    borderRadius: radius.md,
  },
});
