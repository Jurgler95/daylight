import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { InsightCard } from '@/components/insights/InsightCard';
import { AppText } from '@/components/ui';
import { formatMetric } from '@/lib/health/format';
import { SLEEP_GOAL_MINUTES, STEPS_GOAL, type DayWindow, type HealthMetric, type HealthStats } from '@/lib/insights';
import { spacing } from '@/lib/theme';

import { HealthLineChart } from './HealthLineChart';
import { MetricPicker, useMetric } from './metrics';

const GOALS: Partial<Record<HealthMetric, number>> = { sleep: SLEEP_GOAL_MINUTES, steps: STEPS_GOAL };

/** One metric over the range, with its mean, median and extremes underneath. */
export function HealthTrendCard({ stats, window }: { stats: HealthStats; window: DayWindow }) {
  const { t } = useTranslation();
  const [metric, setMetric] = useMetric(stats.metrics);
  const summary = metric ? stats.summaries[metric] : undefined;
  return (
    <InsightCard
      title={t('insights.healthStats.trend.title')}
      controls={metric ? <MetricPicker metrics={stats.metrics} value={metric} onChange={setMetric} /> : null}
      empty={!metric || !summary ? t('insights.healthStats.empty') : null}
    >
      {metric && summary ? (
        <>
          <HealthLineChart metric={metric} points={stats.series[metric] ?? []} window={window} goal={GOALS[metric]} />
          <View style={styles.facts}>
            {(
              [
                ['mean', summary.mean],
                ['median', summary.median],
                ['min', summary.min],
                ['max', summary.max],
              ] as const
            ).map(([key, value]) => (
              <View key={key} style={styles.fact} accessible accessibilityLabel={`${t(`insights.healthStats.trend.${key}`)}: ${formatMetric(metric, value)}`}>
                <AppText variant="caption" muted>
                  {t(`insights.healthStats.trend.${key}`)}
                </AppText>
                <AppText variant="label">{formatMetric(metric, value)}</AppText>
              </View>
            ))}
          </View>
          <AppText variant="caption" muted>
            {summary.previousMean !== null
              ? t('insights.healthStats.trend.before', { count: summary.days, value: formatMetric(metric, summary.previousMean) })
              : t('insights.healthStats.trend.days', { count: summary.days })}
          </AppText>
        </>
      ) : null}
    </InsightCard>
  );
}

const styles = StyleSheet.create({
  facts: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.sm },
  fact: { width: '50%', gap: 2 },
});
