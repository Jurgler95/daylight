import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { formatDecimal, formatRatio, type ActivityPair } from '@/lib/insights';
import { spacing } from '@/lib/theme';

import { ActivityLine } from './ActivityLine';
import { InsightCard } from './InsightCard';
import type { ActivityNames } from './names';

const SHOWN = 6;

/** Activities that come together more often than chance would have them, with the mood on those days. */
export function PairsCard({ pairs, names }: { pairs: ActivityPair[]; names: ActivityNames }) {
  const { t } = useTranslation();
  return (
    <InsightCard title={t('insights.pairs.title')} empty={pairs.length === 0 ? t('insights.pairs.empty') : null}>
      <View style={styles.list}>
        {pairs.slice(0, SHOWN).map((pair) => (
          <ActivityLine
            key={`${pair.a}:${pair.b}`}
            activityId={pair.a}
            icon={names.icon(pair.a)}
            title={t('insights.pairs.pair', { a: names.label(pair.a), b: names.label(pair.b) })}
            detail={t('insights.pairs.detail', { count: pair.together, lift: formatRatio(pair.lift), mean: formatDecimal(pair.mean) })}
          />
        ))}
      </View>
    </InsightCard>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.xs },
});
