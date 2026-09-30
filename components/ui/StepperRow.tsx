import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { TOUCH_TARGET, radius, spacing, useTheme } from '@/lib/theme';

import { AppText } from './AppText';

interface Props {
  label: string;
  value: number | null;
  /** Shown when the value is null, e.g. "Automatisch". */
  emptyLabel?: string;
  unit?: string;
  min: number;
  max: number;
  onChange: (value: number | null) => void;
}

/** Plus/minus row. Stepping below `min` clears the value when an empty label is given. */
export function StepperRow({ label, value, emptyLabel, unit, min, max, onChange }: Props) {
  const { colors } = useTheme();
  const clamp = (next: number) => Math.min(max, Math.max(min, next));
  const step = (delta: number) => {
    if (value === null) return onChange(clamp(delta > 0 ? min : max));
    const next = value + delta;
    if (next < min || next > max) return emptyLabel ? onChange(null) : undefined;
    onChange(next);
  };
  const display = value === null ? (emptyLabel ?? '-') : unit ? `${value} ${unit}` : String(value);

  return (
    <View style={styles.row} accessibilityLabel={`${label}, ${display}`}>
      <AppText style={styles.label}>{label}</AppText>
      <View style={[styles.controls, { backgroundColor: colors.surfaceMuted }]}>
        <Pressable onPress={() => step(-1)} accessibilityRole="button" accessibilityLabel={`${label} verringern`} style={styles.button}>
          <Ionicons name="remove" size={20} color={colors.text} />
        </Pressable>
        <AppText variant="label" style={styles.value}>
          {display}
        </AppText>
        <Pressable onPress={() => step(1)} accessibilityRole="button" accessibilityLabel={`${label} erhöhen`} style={styles.button}>
          <Ionicons name="add" size={20} color={colors.text} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: TOUCH_TARGET + 4 },
  label: { flex: 1 },
  controls: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.pill },
  button: { width: TOUCH_TARGET, height: TOUCH_TARGET, alignItems: 'center', justifyContent: 'center' },
  value: { minWidth: 76, textAlign: 'center' },
});
