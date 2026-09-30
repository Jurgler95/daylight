import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import type { CalendarMarker } from '@/lib/calendar/dayLabel';
import type { DayCell as Cell } from '@/lib/calendar/monthGrid';
import type { DateString } from '@/lib/dates';

import { DayCell } from './DayCell';

/** Fixed so the month list can be virtualised and jumped to without measuring. */
export const WEEK_ROW_HEIGHT = 64;

interface Props {
  week: readonly Cell[];
  markers: ReadonlyMap<string, CalendarMarker>;
  today: DateString;
  label: (date: DateString, marker: CalendarMarker | undefined) => string;
  onSelectDay: (date: DateString) => void;
}

/**
 * One week of a month. Days belonging to the neighbouring month are left blank:
 * in a continuous list they would otherwise appear twice, once greyed and once real.
 * Redraws only when one of its own days changed, not whenever anything in the month list did.
 */
export const WeekRow = memo(function WeekRow({ week, markers, today, label, onSelectDay }: Props) {
  return (
    <View style={styles.row}>
      {week.map((cell) =>
        cell.inMonth ? (
          <DayCell
            key={cell.date}
            date={cell.date}
            dayOfMonth={cell.dayOfMonth}
            marker={markers.get(cell.date)}
            isToday={cell.date === today}
            isFuture={cell.date > today}
            label={label(cell.date, markers.get(cell.date))}
            onPress={() => onSelectDay(cell.date)}
          />
        ) : (
          <View key={cell.date} style={styles.blank} />
        ),
      )}
    </View>
  );
}, sameWeek);

/** Markers keep their object while a day is unchanged, so comparing the week's seven is enough. */
function sameWeek(prev: Props, next: Props): boolean {
  return (
    prev.week === next.week &&
    prev.today === next.today &&
    prev.label === next.label &&
    prev.onSelectDay === next.onSelectDay &&
    next.week.every((cell) => prev.markers.get(cell.date) === next.markers.get(cell.date))
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', height: WEEK_ROW_HEIGHT, paddingTop: 3 },
  blank: { flex: 1 },
});
