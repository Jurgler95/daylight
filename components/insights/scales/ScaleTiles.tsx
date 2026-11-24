import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { StatTile } from '@/components/insights/StatTile';
import type { ScaleInsight } from '@/lib/insights';
import { formatScaleValue } from '@/lib/scales/format';
import { spacing } from '@/lib/theme';

interface Props {
  insights: readonly ScaleInsight[];
  /** The scale the cards below show; its tile is marked, and with two or more scales a tap on a tile picks it. */
  value: number;
  onChange: (id: number) => void;
}

/** Mean per scale over the range, with the range before when there is one. */
export function ScaleTiles({ insights, value, onChange }: Props) {
  const pickable = insights.length > 1;
  const { t } = useTranslation();
  return (
    <View style={styles.tiles} accessibilityRole={pickable ? 'radiogroup' : undefined} accessibilityLabel={pickable ? t('insights.scales.pick') : undefined}>
      {insights.map(({ scale, summary }) => (
        <StatTile
          key={scale.id}
          label={t('insights.tiles.meanOf', { name: scale.name })}
          spokenLabel={t('insights.tiles.meanOfSpoken', { name: scale.name })}
          selected={pickable && scale.id === value}
          onPress={pickable ? () => onChange(scale.id) : undefined}
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
