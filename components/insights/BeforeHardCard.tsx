import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { formatPercent, MIN_HARD_DAYS, type BeforeHardResult } from '@/lib/insights';
import { spacing } from '@/lib/theme';

import { ActivityLine } from './ActivityLine';
import { InsightCard } from './InsightCard';
import type { ActivityNames } from './names';

const SHOWN = 5;

/** Activities that came up in the two days before difficult days more often than before other days. */
export function BeforeHardCard({ result, names }: { result: BeforeHardResult; names: ActivityNames }) {
  const { t } = useTranslation();
  const empty = result.hardDays < MIN_HARD_DAYS ? t('insights.beforeHard.few') : result.items.length === 0 ? t('insights.beforeHard.nothing') : null;
  return (
    <InsightCard title={t('insights.beforeHard.title')} empty={empty}>
      <View style={styles.list}>
        {result.items.slice(0, SHOWN).map((item) => (
          <ActivityLine
            key={item.activityId}
            activityId={item.activityId}
            icon={names.icon(item.activityId)}
            title={names.label(item.activityId)}
            detail={t('insights.beforeHard.row', {
              count: item.hardDays,
              total: result.hardDays,
              share: formatPercent(item.hardShare),
              base: formatPercent(item.baseShare),
            })}
          />
        ))}
      </View>
    </InsightCard>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.xs },
});
