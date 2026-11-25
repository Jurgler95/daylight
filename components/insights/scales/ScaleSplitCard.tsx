import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { InsightCard } from '@/components/insights/InsightCard';
import { AppText } from '@/components/ui';
import { upper } from '@/lib/i18n/language';
import { MIN_BAND_DAYS, type ScaleInsight } from '@/lib/insights';
import { formatScaleDifference, formatScaleValue } from '@/lib/scales/format';
import { spacing, useTheme } from '@/lib/theme';

interface Props {
  insights: readonly ScaleInsight[];
  goodLabel: string;
  hardLabel: string;
}

/** Every scale on good days against hard days, side by side: the overview of what sets those days apart. */
export function ScaleSplitCard({ insights, goodLabel, hardLabel }: Props) {
  const { mood: moodColors } = useTheme();
  const { t } = useTranslation();
  const rows = insights.map(({ scale, split }) => ({
    scale,
    good: split.good === null || split.goodDays < MIN_BAND_DAYS ? null : split.good,
    hard: split.hard === null || split.hardDays < MIN_BAND_DAYS ? null : split.hard,
  }));
  const shown = rows.filter((row) => row.good !== null || row.hard !== null);
  return (
    <InsightCard title={t('insights.scales.split.title')} empty={shown.length === 0 ? t('insights.scales.split.empty') : null}>
      <View style={styles.row} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <View style={styles.name} />
        <AppText variant="caption" color={moodColors[4].strong} style={styles.cell}>
          {upper(t('insights.healthStats.split.good', { mood: goodLabel }))}
        </AppText>
        <AppText variant="caption" color={moodColors[2].strong} style={styles.cell}>
          {upper(t('insights.healthStats.split.hard', { mood: hardLabel }))}
        </AppText>
      </View>
      {shown.map(({ scale, good, hard }) => {
        const a11y = t('insights.healthStats.split.a11y', {
          metric: scale.name,
          good: good === null ? t('insights.healthStats.split.few') : formatScaleValue(scale, good),
          hard: hard === null ? t('insights.healthStats.split.few') : formatScaleValue(scale, hard),
        });
        return (
          <View key={scale.id} style={styles.block} accessible accessibilityLabel={a11y}>
            <View style={styles.row}>
              <AppText variant="label" style={styles.name} numberOfLines={1}>
                {scale.name}
              </AppText>
              <AppText variant="label" style={styles.cell}>
                {good === null ? '' : formatScaleValue(scale, good)}
              </AppText>
              <AppText variant="label" style={styles.cell}>
                {hard === null ? '' : formatScaleValue(scale, hard)}
              </AppText>
            </View>
            {good !== null && hard !== null ? (
              <AppText variant="caption" muted>
                {t('insights.healthStats.split.diff', { diff: formatScaleDifference(scale, good - hard) })}
              </AppText>
            ) : null}
          </View>
        );
      })}
      <AppText variant="caption" muted>
        {t('insights.scales.split.hint', { good: goodLabel, hard: hardLabel })}
      </AppText>
    </InsightCard>
  );
}

const styles = StyleSheet.create({
  block: { gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { flex: 1 },
  cell: { width: 96, textAlign: 'right' },
});
