import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { spacing, useTheme } from '@/lib/theme';

import { AppText } from './AppText';

interface Props {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}

export function EmptyState({ icon, label }: Props) {
  const { colors } = useTheme();
  return (
    <View style={styles.root} accessibilityRole="text" accessibilityLabel={label}>
      <View style={[styles.bubble, { backgroundColor: colors.accentSoft }]}>
        <Ionicons name={icon} size={40} color={colors.accent} />
      </View>
      <AppText variant="headline" muted style={styles.label}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxxl },
  label: { textAlign: 'center' },
  bubble: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
});
