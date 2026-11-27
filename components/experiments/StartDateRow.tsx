import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { formatLong, toDateString, toLocalDate, type DateString } from '@/lib/dates';
import { TOUCH_TARGET, radius, spacing, useTheme } from '@/lib/theme';

interface Props {
  label: string;
  value: DateString;
  min: DateString;
  max: DateString;
  disabled?: boolean;
  onChange: (value: DateString) => void;
}

/**
 * One day between a first and a last, opening the system picker. The editor's `DateTimeRows` ties
 * day and time together and knows no minimum, so the start of an experiment has its own row.
 */
export function StartDateRow({ label, value, min, max, disabled = false, onChange }: Props) {
  const { colors } = useTheme();
  const [iosOpen, setIosOpen] = useState(false);
  const date = toLocalDate(value);
  const minimumDate = toLocalDate(min, '00:00');
  const maximumDate = toLocalDate(max, '23:59');

  const commit = (picked?: Date) => {
    if (!picked) return;
    const day = toDateString(picked);
    onChange(day < min ? min : day > max ? max : day);
  };

  const open = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: date,
        mode: 'date',
        minimumDate,
        maximumDate,
        onChange: (event, picked) => {
          if (event.type === 'set') commit(picked);
        },
      });
      return;
    }
    setIosOpen((current) => !current);
  };

  return (
    <View>
      <Pressable
        onPress={open}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${formatLong(value)}`}
        accessibilityState={{ disabled }}
        style={({ pressed }) => [styles.row, { opacity: disabled ? 0.5 : pressed ? 0.6 : 1 }]}
      >
        <AppText style={styles.label}>{label}</AppText>
        <View style={[styles.value, { backgroundColor: colors.surfaceMuted }]}>
          <AppText variant="label">{formatLong(value)}</AppText>
        </View>
      </Pressable>
      {iosOpen && !disabled ? (
        <DateTimePicker value={date} mode="date" display="inline" minimumDate={minimumDate} maximumDate={maximumDate} onChange={(_, picked) => commit(picked)} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: TOUCH_TARGET + 4 },
  label: { flex: 1 },
  value: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.pill },
});
