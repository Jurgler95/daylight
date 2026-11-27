import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { formatTime, parseTime } from '@/lib/notifications/plan';
import { TOUCH_TARGET, radius, spacing, useTheme } from '@/lib/theme';

interface Props {
  label: string;
  /** "HH:MM". */
  value: string;
  disabled?: boolean;
  /** What a screen reader says instead of "label, value", for a row among several alike. */
  accessibilityLabel?: string;
  onChange: (value: string) => void;
}

/**
 * The system time picker for a "HH:MM" value: `open` shows it (a dialog on Android), `inline` is
 * the spinner iOS shows in place and has to be rendered below whatever opens it.
 */
export function useTimePicker(value: string, onChange: (value: string) => void): { open: () => void; inline: ReactNode } {
  const [iosOpen, setIosOpen] = useState(false);
  const parsed = parseTime(value) ?? { hour: 20, minute: 0 };
  const asDate = new Date(2000, 0, 1, parsed.hour, parsed.minute);

  const commit = (date?: Date) => {
    if (!date) return;
    onChange(formatTime(date.getHours(), date.getMinutes()));
  };

  const open = () => {
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

  return { open, inline: iosOpen ? <DateTimePicker value={asDate} mode="time" display="spinner" onChange={(_, date) => commit(date)} /> : null };
}

/** Opens the system time picker. The stored value stays a plain "HH:MM" string. */
export function TimeRow({ label, value, disabled, accessibilityLabel, onChange }: Props) {
  const { colors } = useTheme();
  const picker = useTimePicker(value, onChange);

  return (
    <View>
      <Pressable
        onPress={picker.open}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? `${label}, ${value}`}
        accessibilityState={{ disabled: !!disabled }}
        style={({ pressed }) => [styles.row, { opacity: disabled ? 0.4 : pressed ? 0.6 : 1 }]}
      >
        <AppText style={styles.label}>{label}</AppText>
        <View style={[styles.value, { backgroundColor: colors.surfaceMuted }]}>
          <AppText variant="label">{value}</AppText>
        </View>
      </Pressable>
      {picker.inline}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: TOUCH_TARGET + 4 },
  label: { flex: 1 },
  value: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.pill },
});
