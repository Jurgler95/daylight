import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { haptics } from '@/lib/haptics';
import { TOUCH_TARGET, radius, spacing, useTheme } from '@/lib/theme';

interface Props {
  placeholder: string;
  addLabel: string;
  /** Returns whether the item was created; the field only clears when it was. */
  onAdd: (name: string) => boolean;
}

/** A field and a plus button to create something by name. */
export function AddRow({ placeholder, addLabel, onAdd }: Props) {
  const { colors } = useTheme();
  const [text, setText] = useState('');
  const add = () => {
    const name = text.trim();
    if (!name) return;
    if (onAdd(name)) {
      haptics.on();
      setText('');
    }
  };
  return (
    <View style={styles.row}>
      <TextInput
        value={text}
        onChangeText={setText}
        onSubmitEditing={add}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        accessibilityLabel={placeholder}
        returnKeyType="done"
        style={[styles.input, { backgroundColor: colors.surfaceMuted, color: colors.text }]}
      />
      <Pressable
        onPress={add}
        disabled={!text.trim()}
        accessibilityRole="button"
        accessibilityLabel={addLabel}
        accessibilityState={{ disabled: !text.trim() }}
        style={({ pressed }) => [styles.button, { backgroundColor: colors.accent, opacity: !text.trim() ? 0.4 : pressed ? 0.6 : 1 }]}
      >
        <Ionicons name="add" size={22} color={colors.textOnAccent} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  input: { flex: 1, minHeight: TOUCH_TARGET, borderRadius: radius.pill, paddingHorizontal: spacing.lg, fontSize: 16 },
  button: { width: TOUCH_TARGET, height: TOUCH_TARGET, borderRadius: TOUCH_TARGET / 2, alignItems: 'center', justifyContent: 'center' },
});
