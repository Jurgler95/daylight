import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { formatTime, parseTime } from '@/lib/notifications/plan';
import { TOUCH_TARGET, radius, spacing, useTheme } from '@/lib/theme';

interface Props {
  label: string;
  /** "HH:MM". */
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}

/** Opens the system time picker. The stored value stays a plain "HH:MM" string. */
export function TimeRow({ label, value, disabled, onChange }: Props) {
  const { colors } = useTheme();
  const [iosOpen, setIosOpen] = useState(false);
  const parsed = parseTime(value) ?? { hour: 20, minute: 0 };
  const asDate = new Date(2000, 0, 1, parsed.hour, parsed.minute);

  const commit = (date?: Date) => {
    if (!date) return;
    onChange(formatTime(date.getHours(), date.getMinutes()));
  };

  const open = () => {
    if (disabled) return;
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: asDate,
        mode: 'time',
        is24Hour: true,
        onChange: (event, date) => {
          if (event.type === 'set') commit(date);
        },
      });
      return;
    }
    setIosOpen((open) => !open);
  };

  return (
    <View>
      <Pressable
        onPress={open}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${value}`}
        style={({ pressed }) => [styles.row, { opacity: disabled ? 0.4 : pressed ? 0.6 : 1 }]}
      >
        <AppText style={styles.label}>{label}</AppText>
        <View style={[styles.value, { backgroundColor: colors.surfaceMuted }]}>
          <AppText variant="label">{value}</AppText>
        </View>
      </Pressable>
      {iosOpen ? (
        <DateTimePicker value={asDate} mode="time" display="spinner" onChange={(_, date) => commit(date)} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: TOUCH_TARGET + 4 },
  label: { flex: 1 },
  value: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.pill },
});
