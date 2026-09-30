import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { haptics } from '@/lib/haptics';
import { TOUCH_TARGET, spacing, useTheme } from '@/lib/theme';

import { AppText } from './AppText';

interface Props {
  label: string;
  hint?: string;
  selected: boolean;
  onPress: () => void;
}

/** A radio row. The check mark, not the colour, carries the meaning. */
export function OptionRow({ label, hint, selected, onPress }: Props) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => {
        if (!selected) haptics.on();
        onPress();
      }}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      accessibilityHint={hint}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}
    >
      <View style={styles.text}>
        <AppText>{label}</AppText>
        {hint ? (
          <AppText variant="caption" muted>
            {hint}
          </AppText>
        ) : null}
      </View>
      {/* Keyed on the state, so the check mark pops in fresh each time the row is picked. */}
      <Animated.View key={selected ? 'on' : 'off'} entering={selected ? ZoomIn.duration(120) : undefined}>
        <Ionicons
          name={selected ? 'checkmark-circle' : 'ellipse-outline'}
          size={24}
          color={selected ? colors.accent : colors.textMuted}
        />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: TOUCH_TARGET + 4 },
  text: { flex: 1, gap: 2 },
});
