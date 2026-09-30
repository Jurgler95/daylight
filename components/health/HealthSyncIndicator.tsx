import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui';
import { formatMonthYear } from '@/lib/dates';
import { useHealthSyncStore } from '@/lib/health/store';
import { radius, spacing, useTheme, withAlpha } from '@/lib/theme';

/**
 * A small spinner in the top right corner while Health Connect is read. It lies over every screen
 * without catching touches; during a long backfill the month being read stands next to it.
 */
export function HealthSyncIndicator() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const running = useHealthSyncStore((s) => s.running);
  const month = useHealthSyncStore((s) => s.month);
  if (!running) return null;

  const label = month ? t('health.syncingMonth', { month: formatMonthYear(month) }) : t('health.syncing');
  return (
    <View
      pointerEvents="none"
      style={[styles.wrap, { top: insets.top + spacing.sm, backgroundColor: withAlpha(colors.surface, 0.85) }]}
      accessible
      accessibilityLabel={label}
      accessibilityLiveRegion="polite"
    >
      {month ? (
        <AppText variant="caption" muted>
          {formatMonthYear(month)}
        </AppText>
      ) : null}
      <ActivityIndicator size="small" color={colors.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
});
