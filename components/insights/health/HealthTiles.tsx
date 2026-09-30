import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { StatTile } from '@/components/insights/StatTile';
import { formatDuration, formatMetric } from '@/lib/health/format';
import type { HealthStats } from '@/lib/insights';
import { spacing } from '@/lib/theme';

/** Mean per metric over the range, with the range before when there is one; training per week. */
export function HealthTiles({ stats }: { stats: HealthStats }) {
  const { t } = useTranslation();
  return (
    <View style={styles.tiles}>
      {stats.metrics.map((metric) => {
        const summary = stats.summaries[metric]!;
        if (metric === 'exercise' && stats.goals.exercise) {
          return (
            <StatTile
              key={metric}
              label={t('insights.healthStats.tiles.exercise')}
              value={formatDuration(stats.goals.exercise.minutesPerWeek)}
              hint={t('insights.healthStats.tiles.exerciseDays', { count: stats.goals.exercise.hit })}
            />
          );
        }
        const hint =
          summary.previousMean !== null
            ? t('insights.healthStats.tiles.before', { value: formatMetric(metric, summary.previousMean) })
            : t('insights.healthStats.tiles.days', { count: summary.days });
        return <StatTile key={metric} label={t(`insights.healthStats.tiles.${metric}`)} value={formatMetric(metric, summary.mean)} hint={hint} />;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
});
