import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { InsightCard } from '@/components/insights/InsightCard';
import { AppText } from '@/components/ui';
import { formatMetric } from '@/lib/health/format';
import { orderWeekdays, type HealthStats } from '@/lib/insights';
import { radius, spacing, useTheme } from '@/lib/theme';

import { MetricPicker, useMetric } from './metrics';

interface Props {
  stats: HealthStats;
  /** Short names, Sunday first. */
  names: string[];
  firstDay: number;
}

/** Mean of one metric per weekday. The pulse bars start a little below its lowest weekday, else all would look equal. */
export function HealthWeekdayCard({ stats, names, firstDay }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [metric, setMetric] = useMetric(stats.metrics);
  const rows = metric ? orderWeekdays(stats.weekdays[metric] ?? [], firstDay) : [];
  const means = rows.flatMap((row) => (row.mean === null ? [] : [row.mean]));
  const max = Math.max(1, ...means);
  const lo = metric === 'restingHr' && means.length ? Math.min(...means) - 3 : 0;
  return (
    <InsightCard
      title={t('insights.healthStats.weekdays.title')}
      controls={metric ? <MetricPicker metrics={stats.metrics} value={metric} onChange={setMetric} /> : null}
      empty={!metric ? t('insights.healthStats.empty') : null}
    >
      {metric
        ? rows.map((row) => {
            const name = names[row.weekday] ?? '';
            const value = row.mean === null ? '' : formatMetric(metric, row.mean);
            return (
              <View
                key={row.weekday}
                style={styles.row}
                accessible
                accessibilityLabel={row.mean === null ? t('insights.weekdays.none', { day: name }) : t('insights.healthStats.weekdays.a11y', { day: name, value, count: row.days })}
              >
                <AppText variant="label" style={styles.name}>
                  {name}
                </AppText>
                <View style={[styles.track, { backgroundColor: colors.surfaceMuted }]}>
                  {row.mean !== null ? <View style={[styles.bar, { width: `${Math.max(0.02, (row.mean - lo) / (max - lo)) * 100}%`, backgroundColor: colors.accent }]} /> : null}
                </View>
                <AppText variant="label" style={styles.value} numberOfLines={1}>
                  {value}
                </AppText>
              </View>
            );
          })
        : null}
    </InsightCard>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 28 },
  name: { width: 28 },
  track: { flex: 1, height: 12, borderRadius: radius.pill, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: radius.pill },
  value: { width: 92, textAlign: 'right' },
});
