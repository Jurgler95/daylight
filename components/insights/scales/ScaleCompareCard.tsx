import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { InsightCard } from '@/components/insights/InsightCard';
import { AppText } from '@/components/ui';
import type { ScaleComparison } from '@/lib/insights';
import { formatScaleDifference, formatScaleValue } from '@/lib/scales/format';
import { spacing } from '@/lib/theme';

/** Each scale on the days of a detail page against all other days; nothing when no scale has enough of both. */
export function ScaleCompareCard({ comparisons }: { comparisons: readonly ScaleComparison[] }) {
  const { t } = useTranslation();
  if (comparisons.length === 0) return null;
  return (
    <InsightCard title={t('insights.scales.compare.title')}>
      {comparisons.map(({ scale, withMean, withoutMean, withDays }) => {
        const detail = t('insights.scales.compare.row', { with: formatScaleValue(scale, withMean), without: formatScaleValue(scale, withoutMean), count: withDays });
        return (
          <View key={scale.id} style={styles.row} accessible accessibilityLabel={`${scale.name}: ${detail}`}>
            <View style={styles.text}>
              <AppText variant="label">{scale.name}</AppText>
              <AppText variant="caption" muted>
                {detail}
              </AppText>
            </View>
            <AppText variant="label">{formatScaleDifference(scale, withMean - withoutMean)}</AppText>
          </View>
        );
      })}
    </InsightCard>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 44 },
  text: { flex: 1, gap: 2 },
});
