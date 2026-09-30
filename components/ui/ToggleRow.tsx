import { StyleSheet, Switch, View } from 'react-native';

import { TOUCH_TARGET, spacing, useTheme } from '@/lib/theme';

import { AppText } from './AppText';

interface Props {
  label: string;
  hint?: string;
  value: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}

export function ToggleRow({ label, hint, value, disabled, onChange }: Props) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <AppText>{label}</AppText>
        {hint ? (
          <AppText variant="caption" muted>
            {hint}
          </AppText>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        accessibilityLabel={label}
        accessibilityHint={hint}
        trackColor={{ true: colors.accent, false: colors.surfaceMuted }}
        thumbColor={colors.surface}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: TOUCH_TARGET + 4 },
  text: { flex: 1, gap: 2 },
});
