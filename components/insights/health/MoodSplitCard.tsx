import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { InsightCard } from '@/components/insights/InsightCard';
import { AppText } from '@/components/ui';
import { formatMetric, formatMetricDifference } from '@/lib/health/format';
import { MIN_BAND_DAYS, type MoodSplit } from '@/lib/insights';
import { moodColors, spacing, useTheme } from '@/lib/theme';

import { METRIC_ICONS } from './metrics';

interface Props {
  splits: MoodSplit[];
  goodLabel: string;
  hardLabel: string;
}

/** Each metric on good days against hard days: what the body did on the days that felt best and worst. */
export function MoodSplitCard({ splits, goodLabel, hardLabel }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const value = (split: MoodSplit, side: 'good' | 'hard') => {
    const mean = split[side];
    const days = side === 'good' ? split.goodDays : split.hardDays;
    return mean === null || days < MIN_BAND_DAYS ? null : mean;
  };
  const shown = splits.filter((split) => value(split, 'good') !== null || value(split, 'hard') !== null);
  return (
    <InsightCard title={t('insights.healthStats.split.title')} empty={shown.length === 0 ? t('insights.healthStats.split.empty') : null}>
      <View style={styles.row} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <View style={styles.name} />
        <AppText variant="caption" color={moodColors[4].strong} style={styles.cell}>
          {t('insights.healthStats.split.good', { mood: goodLabel }).toUpperCase()}
        </AppText>
        <AppText variant="caption" color={moodColors[2].strong} style={styles.cell}>
          {t('insights.healthStats.split.hard', { mood: hardLabel }).toUpperCase()}
        </AppText>
      </View>
      {shown.map((split) => {
        const good = value(split, 'good');
        const hard = value(split, 'hard');
        const name = t(`insights.healthStats.metric.${split.metric}`);
        const a11y = t('insights.healthStats.split.a11y', {
          metric: name,
          good: good === null ? t('insights.healthStats.split.few') : formatMetric(split.metric, good),
          hard: hard === null ? t('insights.healthStats.split.few') : formatMetric(split.metric, hard),
        });
        return (
          <View key={split.metric} style={styles.block} accessible accessibilityLabel={a11y}>
            <View style={styles.row}>
              <View style={[styles.name, styles.nameRow]}>
                <MaterialCommunityIcons name={METRIC_ICONS[split.metric]} size={16} color={colors.textMuted} />
                <AppText variant="label">{name}</AppText>
              </View>
              <AppText variant="label" style={styles.cell}>
                {good === null ? '' : formatMetric(split.metric, good)}
              </AppText>
              <AppText variant="label" style={styles.cell}>
                {hard === null ? '' : formatMetric(split.metric, hard)}
              </AppText>
            </View>
            {good !== null && hard !== null ? (
              <AppText variant="caption" muted>
                {t('insights.healthStats.split.diff', { diff: formatMetricDifference(split.metric, good - hard) })}
              </AppText>
            ) : null}
          </View>
        );
      })}
      <AppText variant="caption" muted>
        {t('insights.healthStats.split.hint', { good: goodLabel, hard: hardLabel })}
      </AppText>
    </InsightCard>
  );
}

const styles = StyleSheet.create({
  block: { gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  cell: { width: 96, textAlign: 'right' },
});
