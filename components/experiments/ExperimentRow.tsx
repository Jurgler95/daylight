import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText, PressableScale } from '@/components/ui';
import type { Experiment } from '@/db/schema';
import { formatRange, type DateString } from '@/lib/dates';
import { experimentStatus } from '@/lib/experiments/view';
import { haptics } from '@/lib/haptics';
import { TOUCH_TARGET, spacing, useTheme } from '@/lib/theme';

/** One experiment with its span and how far it is; opens its comparison. */
export function ExperimentRow({ experiment, today, last = false }: { experiment: Experiment; today: DateString; last?: boolean }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const status = experimentStatus(t, experiment, today);
  const range = formatRange(experiment.start_date as DateString, experiment.end_date as DateString);
  return (
    <PressableScale
      pressedScale={0.98}
      onPress={() => {
        haptics.tap();
        router.push({ pathname: '/experiments/[id]', params: { id: String(experiment.id) } });
      }}
      accessibilityRole="button"
      accessibilityLabel={`${experiment.title}, ${range}, ${status}`}
      style={[styles.row, last ? null : { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}
    >
      <View style={styles.text}>
        <AppText variant="label">{experiment.title}</AppText>
        <AppText variant="caption" muted>
          {range}
        </AppText>
      </View>
      <AppText variant="caption">{status}</AppText>
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: TOUCH_TARGET + 8, paddingVertical: spacing.sm },
  text: { flex: 1, gap: 2 },
});
