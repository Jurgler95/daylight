import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { CARD_OPACITY, radius, spacing, useTheme, withAlpha } from '@/lib/theme';

interface Props {
  label: string;
  value: string;
  hint?: string;
}

export function StatTile({ label, value, hint }: Props) {
  const { colors } = useTheme();
  return (
    <View style={[styles.tile, { backgroundColor: withAlpha(colors.surface, CARD_OPACITY) }]} accessible accessibilityRole="text" accessibilityLabel={`${label}: ${value}${hint ? `, ${hint}` : ''}`}>
      <AppText variant="caption" muted>
        {label.toUpperCase()}
      </AppText>
      <AppText variant="title">{value}</AppText>
      {hint ? (
        <AppText variant="caption" muted>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { flex: 1, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.xs, minWidth: 140 },
});
