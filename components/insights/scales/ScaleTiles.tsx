import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { StatTile } from '@/components/insights/StatTile';
import type { ScaleInsight } from '@/lib/insights';
import { formatScaleValue } from '@/lib/scales/format';
import { spacing } from '@/lib/theme';

/** Mean per scale over the range, with the range before when there is one. */
export function ScaleTiles({ insights }: { insights: readonly ScaleInsight[] }) {
  const { t } = useTranslation();
  return (
    <View style={styles.tiles}>
      {insights.map(({ scale, summary }) => (
        <StatTile
          key={scale.id}
          label={scale.name}
          value={formatScaleValue(scale, summary.mean)}
          hint={
            summary.previousMean !== null
              ? t('insights.healthStats.tiles.before', { value: formatScaleValue(scale, summary.previousMean) })
              : t('insights.healthStats.tiles.days', { count: summary.days })
          }
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
});
