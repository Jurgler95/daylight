import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { formatLong, toDateString, toLocalDate, toTimeString, type DateString } from '@/lib/dates';
import { TOUCH_TARGET, radius, spacing, useTheme } from '@/lib/theme';

interface Props {
  date: DateString;
  time: string;
  /** Latest selectable day: entries are about days that happened. */
  maxDate: DateString;
  dateLabel: string;
  timeLabel: string;
  onChange: (patch: { date?: DateString; time?: string }) => void;
}

type Mode = 'date' | 'time';

/** Day and time of an entry, each opening the system picker. Stored values stay plain strings. */
export function DateTimeRows({ date, time, maxDate, dateLabel, timeLabel, onChange }: Props) {
  const [iosOpen, setIosOpen] = useState<Mode | null>(null);
  const value = toLocalDate(date, time);
  const maximumDate = toLocalDate(maxDate, '23:59');

  const commit = (mode: Mode, picked?: Date) => {
    if (!picked) return;
    if (mode === 'date') onChange({ date: toDateString(picked) });
    else onChange({ time: toTimeString(picked) });
  };

  const open = (mode: Mode) => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value,
        mode,
        is24Hour: true,
        maximumDate: mode === 'date' ? maximumDate : undefined,
        onChange: (event, picked) => {
          if (event.type === 'set') commit(mode, picked);
        },
      });
      return;
    }
    setIosOpen((current) => (current === mode ? null : mode));
  };

  return (
    <View>
      <Row label={dateLabel} value={formatLong(date)} onPress={() => open('date')} />
      {iosOpen === 'date' ? (
        <DateTimePicker value={value} mode="date" display="inline" maximumDate={maximumDate} onChange={(_, picked) => commit('date', picked)} />
      ) : null}
      <Row label={timeLabel} value={time} onPress={() => open('time')} />
      {iosOpen === 'time' ? <DateTimePicker value={value} mode="time" display="spinner" onChange={(_, picked) => commit('time', picked)} /> : null}
    </View>
  );
}

function Row({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${value}`}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}
    >
      <AppText style={styles.label}>{label}</AppText>
      <View style={[styles.value, { backgroundColor: colors.surfaceMuted }]}>
        <AppText variant="label">{value}</AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: TOUCH_TARGET + 4 },
  label: { flex: 1 },
  value: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.pill },
});
