import { useCallback, useImperativeHandle, useMemo, useRef, type Ref } from 'react';
import { SectionList, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import type { CalendarMarker } from '@/lib/calendar/dayLabel';
import { buildMonthGrid, monthsBetween, type DayCell as Cell, type WeekStart } from '@/lib/calendar/monthGrid';
import { formatMonthYear, weekdayLabels, type DateString } from '@/lib/dates';
import { spacing, useTheme } from '@/lib/theme';

import { WeekRow, WEEK_ROW_HEIGHT } from './WeekRow';

/** Fixed so `getItemLayout` can place any month without measuring it first. */
const HEADER_HEIGHT = 64;

interface Section {
  month: DateString;
  data: Cell[][];
}

export interface MonthListHandle {
  scrollToMonth: (month: DateString) => void;
}

interface Props {
  months: DateString[];
  /** Scrolled to on mount and by the "Heute" button. */
  current: DateString;
  weekStartsOn: WeekStart;
  today: DateString;
  markers: ReadonlyMap<string, CalendarMarker>;
  label: (date: DateString, marker: CalendarMarker | undefined) => string;
  onSelectDay: (date: DateString) => void;
  contentPaddingBottom: number;
  ref?: Ref<MonthListHandle>;
}

/**
 * Every month in one continuous scroll, oldest first. The month name and the weekday
 * row stay pinned while their month passes under them.
 */
export function MonthList({
  months,
  current,
  weekStartsOn,
  today,
  markers,
  label,
  onSelectDay,
  contentPaddingBottom,
  ref,
}: Props) {
  const { colors } = useTheme();
  const list = useRef<SectionList<Cell[], Section>>(null);
  const labels = useMemo(() => weekdayLabels(weekStartsOn), [weekStartsOn]);

  const sections = useMemo<Section[]>(
    () => months.map((month) => ({ month, data: buildMonthGrid(month, weekStartsOn) })),
    [months, weekStartsOn],
  );
  const currentIndex = Math.max(0, months.indexOf(current));

  // A section flattens to a header, its weeks, and a zero-height footer, in that order.
  const getItemLayout = useCallback(
    (_: unknown, index: number) => {
      let offset = 0;
      let flat = 0;
      for (const section of sections) {
        if (flat === index) return { length: HEADER_HEIGHT, offset, index };
        offset += HEADER_HEIGHT;
        flat++;
        for (let week = 0; week < section.data.length; week++) {
          if (flat === index) return { length: WEEK_ROW_HEIGHT, offset, index };
          offset += WEEK_ROW_HEIGHT;
          flat++;
        }
        if (flat === index) return { length: 0, offset, index };
        flat++;
      }
      return { length: 0, offset, index };
    },
    [sections],
  );

  const jumpTo = useCallback(
    (sectionIndex: number, animated: boolean) =>
      list.current?.scrollToLocation({ sectionIndex, itemIndex: 0, viewPosition: 0, animated }),
    [],
  );

  useImperativeHandle(ref, () => ({ scrollToMonth: (month) => jumpTo(Math.max(0, months.indexOf(month)), true) }), [jumpTo, months]);

  // The list starts at the oldest month, so it has to be moved to the current one once.
  // On layout rather than in an effect: before the list has a height, scrolling is a no-op.
  const positioned = useRef(false);
  const positionOnFirstLayout = useCallback(() => {
    if (positioned.current) return;
    positioned.current = true;
    jumpTo(currentIndex, false);
  }, [jumpTo, currentIndex]);

  return (
    <SectionList
      ref={list}
      sections={sections}
      keyExtractor={(week, index) => `${week[0]?.date ?? index}`}
      extraData={markers}
      renderItem={({ item }) => (
        <WeekRow week={item} markers={markers} today={today} label={label} onSelectDay={onSelectDay} />
      )}
      renderSectionHeader={({ section }) => (
        // Opaque, because rows scroll underneath it while it is pinned; the same white as the calendar panel.
        <View style={[styles.header, { backgroundColor: colors.surface }]}>
          <AppText variant="headline">{formatMonthYear(section.month)}</AppText>
          <View style={styles.weekdays}>
            {labels.map((day) => (
              <AppText key={day} variant="caption" muted style={styles.weekday}>
                {day}
              </AppText>
            ))}
          </View>
        </View>
      )}
      stickySectionHeadersEnabled
      getItemLayout={getItemLayout}
      onScrollToIndexFailed={() => undefined}
      onLayout={positionOnFirstLayout}
      initialNumToRender={8}
      maxToRenderPerBatch={8}
      windowSize={7}
      contentContainerStyle={{ paddingBottom: contentPaddingBottom }}
    />
  );
}

const styles = StyleSheet.create({
  header: { height: HEADER_HEIGHT, justifyContent: 'center', gap: spacing.xs },
  weekdays: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center' },
});
