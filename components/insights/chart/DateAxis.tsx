import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { addDaysToDateString, formatShort } from '@/lib/dates';
import { windowLength, type DayWindow } from '@/lib/insights';

/** Dates under a plot: first and last day, and evenly spaced ones between when `ticks` asks for more. */
export function DateAxis({ window, inset, ticks = 2 }: { window: DayWindow; inset: number; ticks?: number }) {
  const span = Math.max(1, windowLength(window) - 1);
  const count = Math.max(2, Math.min(ticks, span + 1));
  const dates = Array.from({ length: count }, (_, i) => (i === count - 1 ? window.to : addDaysToDateString(window.from, Math.round((i / (count - 1)) * span))));
  return (
    <View style={[styles.axis, { paddingLeft: inset }]}>
      {dates.map((date, i) => (
        <AppText key={`${date}-${i}`} variant="caption" muted>
          {formatShort(date)}
        </AppText>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  axis: { flexDirection: 'row', justifyContent: 'space-between' },
});
