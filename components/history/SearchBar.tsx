import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { TOUCH_TARGET, radius, spacing, useTheme } from '@/lib/theme';

interface Props {
  value: string;
  placeholder: string;
  label: string;
  clearLabel: string;
  onChange: (value: string) => void;
}

/** A single-line search field with a clear button. */
export function SearchBar({ value, placeholder, label, clearLabel, onChange }: Props) {
  const { colors } = useTheme();
  return (
    <View style={[styles.bar, { backgroundColor: colors.surfaceMuted }]}>
      <Ionicons name="search" size={18} color={colors.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        accessibilityLabel={label}
        returnKeyType="search"
        autoCorrect={false}
        style={[styles.input, { color: colors.text }]}
      />
      {value ? (
        <Pressable onPress={() => onChange('')} accessibilityRole="button" accessibilityLabel={clearLabel} hitSlop={8} style={styles.clear}>
          <Ionicons name="close-circle" size={20} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: TOUCH_TARGET, borderRadius: radius.pill, paddingHorizontal: spacing.lg },
  input: { flex: 1, fontSize: 16, paddingVertical: spacing.sm },
  clear: { minWidth: 28, minHeight: 28, alignItems: 'center', justifyContent: 'center' },
});
