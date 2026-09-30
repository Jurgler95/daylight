import { Pressable, StyleSheet } from 'react-native';

import type { CalendarMarker } from '@/lib/calendar/dayLabel';
import type { DateString } from '@/lib/dates';

import { DayGlyph } from './DayGlyph';

export type { CalendarMarker };

interface Props {
  date: DateString;
  dayOfMonth: number;
  marker: CalendarMarker | undefined;
  isToday: boolean;
  isFuture: boolean;
  label: string;
  onPress: () => void;
}

export function DayCell({ dayOfMonth, marker, isToday, isFuture, label, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.cell, { opacity: pressed ? 0.6 : 1 }]}
    >
      <DayGlyph marker={marker} isToday={isToday} isFuture={isFuture} dayOfMonth={dayOfMonth} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cell: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
