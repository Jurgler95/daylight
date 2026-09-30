import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText, Card } from '@/components/ui';
import type { HealthDay } from '@/db/schema';
import { formatDuration, formatSteps } from '@/lib/health/format';
import type { IconName } from '@/lib/icons';
import { radius, spacing, tileColors, useTheme } from '@/lib/theme';

interface Props {
  day: HealthDay;
}

interface Tile {
  key: string;
  icon: IconName;
  value: string;
  label: string;
}

/** The day's values from Health Connect on "Heute", one tile each; missing values leave no gap. */
export function HealthDayCard({ day }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const tiles: Tile[] = [];
  if (day.sleep_minutes !== null) tiles.push({ key: 'sleep', icon: 'power-sleep', value: formatDuration(day.sleep_minutes), label: t('health.day.sleep') });
  if (day.steps !== null) tiles.push({ key: 'steps', icon: 'shoe-print', value: formatSteps(day.steps), label: t('health.day.steps') });
  if (day.exercise_minutes !== null && day.exercise_minutes > 0) {
    tiles.push({ key: 'exercise', icon: 'run', value: formatDuration(day.exercise_minutes), label: t('health.day.exercise') });
  }
  if (day.resting_hr !== null) tiles.push({ key: 'hr', icon: 'heart-pulse', value: t('health.day.bpm', { value: day.resting_hr }), label: t('health.day.restingHr') });
  if (tiles.length === 0) return null;

  return (
    <Card>
      <AppText variant="caption" muted accessibilityRole="header">
        {t('health.day.title').toUpperCase()}
      </AppText>
      <View style={styles.grid}>
        {tiles.map((tile, i) => {
          const tint = tileColors[(i + 3) % tileColors.length]!;
          return (
            <View key={tile.key} style={styles.tile} accessible accessibilityLabel={`${tile.label}: ${tile.value}`}>
              <View style={[styles.icon, { backgroundColor: tint.soft }]}>
                <MaterialCommunityIcons name={tile.icon} size={20} color={tint.strong} />
              </View>
              <View style={styles.text}>
                <AppText variant="headline">{tile.value}</AppText>
                <AppText variant="caption" color={colors.textMuted}>
                  {tile.label}
                </AppText>
              </View>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.md },
  tile: { width: '50%', flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingRight: spacing.sm },
  icon: { width: 36, height: 36, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1 },
});
