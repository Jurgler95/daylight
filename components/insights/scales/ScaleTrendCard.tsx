import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { InsightCard } from '@/components/insights/InsightCard';
import { ValueLineChart } from '@/components/insights/ValueLineChart';
import { AppText } from '@/components/ui';
import { formatShort } from '@/lib/dates';
import type { DayWindow, ScaleInsight } from '@/lib/insights';
import { formatScaleValue } from '@/lib/scales/format';
import { numberChartRange } from '@/lib/scales/range';
import { spacing } from '@/lib/theme';

/**
 * The scale's course over the range, with mean, median and extremes underneath. A rating spans its
 * whole range, so 3 of 5 looks like the middle; a duration starts at 0.
 */
export function ScaleTrendCard({ insight, window }: { insight: ScaleInsight; window: DayWindow }) {
  const { t } = useTranslation();
  const { scale, summary, series } = insight;
  const format = (value: number) => formatScaleValue(scale, value);
  const [lo, hi] =
    scale.kind === 'number'
      ? numberChartRange([summary.min, summary.max, ...series.map((point) => point.rolling)], scale.decimals)
      : scale.kind === 'duration'
        ? [0, Math.max(60, summary.max * 1.05)]
        : [scale.min, scale.max];
  const last = series[series.length - 1];
  const label = t('insights.healthStats.trend.a11y', {
    metric: scale.name,
    from: formatShort(window.from),
    to: formatShort(window.to),
    count: series.length,
    last: last ? format(last.rolling) : '',
  });
  return (
    <InsightCard title={t('insights.scales.trend', { name: scale.name })}>
      <ValueLineChart points={series} window={window} lo={lo} hi={hi} format={scale.kind === 'rating' ? (value) => String(value) : format} accessibilityLabel={label} />
      <View style={styles.facts}>
        {(
          [
            ['mean', summary.mean],
            ['median', summary.median],
            ['min', summary.min],
            ['max', summary.max],
          ] as const
        ).map(([key, value]) => (
          <View key={key} style={styles.fact} accessible accessibilityLabel={`${t(`insights.healthStats.trend.${key}`)}: ${format(value)}`}>
            <AppText variant="caption" muted>
              {t(`insights.healthStats.trend.${key}`)}
            </AppText>
            <AppText variant="label">{format(value)}</AppText>
          </View>
        ))}
      </View>
      <AppText variant="caption" muted>
        {summary.previousMean !== null
          ? t('insights.healthStats.trend.before', { count: summary.days, value: format(summary.previousMean) })
          : t('insights.healthStats.trend.days', { count: summary.days })}
      </AppText>
    </InsightCard>
  );
}

const styles = StyleSheet.create({
  facts: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.sm },
  fact: { width: '50%', gap: 2 },
});
