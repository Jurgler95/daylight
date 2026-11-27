import { StyleSheet, TextInput, View } from 'react-native';

import { TOUCH_TARGET, radius, spacing, useTheme } from '@/lib/theme';

import { AppText } from './AppText';

interface Props {
  label: string;
  value: string;
  placeholder?: string;
  multiline?: boolean;
  /** Stops typing at this many characters. */
  maxLength?: number;
  onChangeText: (value: string) => void;
  onBlur?: () => void;
}

export function TextField({ label, value, placeholder, multiline, maxLength, onChangeText, onBlur }: Props) {
  const { colors } = useTheme();
  return (
    <View style={styles.field}>
      <AppText variant="label" muted>
        {label}
      </AppText>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onBlur={onBlur}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        multiline={multiline}
        maxLength={maxLength}
        accessibilityLabel={label}
        style={[styles.input, multiline && styles.multiline, { backgroundColor: colors.surfaceMuted, color: colors.text }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.sm },
  input: { minHeight: TOUCH_TARGET, borderRadius: radius.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, fontSize: 16 },
  multiline: { minHeight: TOUCH_TARGET * 2, textAlignVertical: 'top' },
});
