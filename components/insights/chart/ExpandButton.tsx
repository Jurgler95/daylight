import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet } from 'react-native';

import { TOUCH_TARGET, useTheme } from '@/lib/theme';

/** The small button that opens a chart large and turned sideways. */
export function ExpandButton({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('insights.chart.expand')}
      hitSlop={8}
      style={({ pressed }) => [styles.button, { opacity: pressed ? 0.5 : 1 }]}
    >
      <Ionicons name="expand-outline" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { marginLeft: 'auto', minWidth: TOUCH_TARGET / 1.5, minHeight: TOUCH_TARGET / 1.5, alignItems: 'flex-end', justifyContent: 'center' },
});
