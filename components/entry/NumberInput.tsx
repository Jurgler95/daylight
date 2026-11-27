import { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { formatDecimal } from '@/lib/insights/format';
import { parseNumberInput } from '@/lib/scales/number';
import { TOUCH_TARGET, radius, spacing, useTheme } from '@/lib/theme';

interface Props {
  label: string;
  /** The value, or null while nothing is set. */
  value: number | null;
  unit: string;
  decimals: number;
  /** Shown under the field while the text is not a number. */
  invalidLabel: string;
  onChange: (value: number | null) => void;
}

function textOf(value: number | null, decimals: number): string {
  return value === null ? '' : formatDecimal(value, decimals);
}

/**
 * A number scale, typed in: comma or dot, as many decimals as the scale has (more are rounded).
 * Emptying the field clears the value. While the text is unreadable the last good value stays and
 * a line under the field says so, so nothing half typed gets saved.
 */
export function NumberInput({ label, value, unit, decimals, invalidLabel, onChange }: Props) {
  const { colors } = useTheme();
  const [text, setText] = useState(() => textOf(value, decimals));
  const parsed = parseNumberInput(text, decimals);

  // A value set from outside (draft restored, entry reloaded) shows up; typing does not get reformatted.
  useEffect(() => {
    if (parsed !== value) setText(textOf(value, decimals));
    // Only when the value itself changes, not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, decimals]);

  const change = (next: string) => {
    setText(next);
    const result = parseNumberInput(next, decimals);
    if (result !== 'invalid' && result !== value) onChange(result);
  };

  return (
    <View style={styles.root}>
      <View style={styles.row}>
        <AppText variant="label" style={styles.label}>
          {label}
        </AppText>
        <View style={[styles.field, { backgroundColor: colors.surfaceMuted }]}>
          <TextInput
            value={text}
            onChangeText={change}
            onBlur={() => parsed !== 'invalid' && setText(textOf(parsed, decimals))}
            keyboardType={decimals > 0 ? 'decimal-pad' : 'numeric'}
            placeholder={formatDecimal(0, decimals)}
            placeholderTextColor={colors.textMuted}
            maxLength={12}
            accessibilityLabel={unit ? `${label}, ${unit}` : label}
            style={[styles.input, { color: value === null ? colors.textMuted : colors.accent }]}
          />
          {unit ? (
            <AppText variant="label" muted style={styles.unit}>
              {unit}
            </AppText>
          ) : null}
        </View>
      </View>
      {parsed === 'invalid' ? (
        <AppText variant="caption" color={colors.danger} accessibilityLiveRegion="polite">
          {invalidLabel}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.xs },
  // With a large font the field moves below the name instead of squeezing it.
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  label: { flexShrink: 1 },
  field: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.pill, paddingHorizontal: spacing.lg, minHeight: TOUCH_TARGET },
  input: { minWidth: 72, textAlign: 'right', fontSize: 16, fontWeight: '600', paddingVertical: spacing.sm },
  unit: { marginLeft: spacing.xs },
});
