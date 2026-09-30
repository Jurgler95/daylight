import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ActivityLine } from '@/components/insights/ActivityLine';
import { InsightCard } from '@/components/insights/InsightCard';
import type { ActivityNames } from '@/components/insights/names';
import { AppText, Button } from '@/components/ui';
import { formatMetric } from '@/lib/health/format';
import type { ActivityHealthEffect, HealthStats } from '@/lib/insights';
import { spacing } from '@/lib/theme';

import { MetricPicker, useMetric } from './metrics';

/** Rows per side before "Alle zeigen". */
const SHOWN = 4;

/**
 * Sleep, steps, pulse and training on days with an activity against days without, like the mood
 * effects. Sleep is the night after the activity day: what a late evening did to the night.
 */
export function ActivityHealthCard({ stats, names }: { stats: HealthStats; names: ActivityNames }) {
  const { t } = useTranslation();
  const [all, setAll] = useState(false);
  const [metric, setMetric] = useMetric(stats.metrics);
  const effects = metric ? stats.activities[metric] : undefined;
  const sentence = (effect: ActivityHealthEffect) =>
    t(metric === 'sleep' ? 'insights.healthStats.activities.nightSentence' : 'insights.healthStats.activities.sentence', {
      with: formatMetric(metric!, effect.withMean),
      without: formatMetric(metric!, effect.withoutMean),
      count: effect.withDays,
    });
  const side = (title: string, list: ActivityHealthEffect[]) =>
    list.length ? (
      <View style={styles.side}>
        <AppText variant="caption" muted>
          {title.toUpperCase()}
        </AppText>
        {(all ? list : list.slice(0, SHOWN)).map((effect) => (
          <ActivityLine key={effect.activityId} activityId={effect.activityId} icon={names.icon(effect.activityId)} title={names.label(effect.activityId)} detail={sentence(effect)} />
        ))}
      </View>
    ) : null;
  const empty = !metric || !effects || effects.lifts.length + effects.lowers.length === 0;
  const more = !!effects && (effects.lifts.length > SHOWN || effects.lowers.length > SHOWN);

  return (
    <InsightCard
      title={t('insights.healthStats.activities.title')}
      controls={metric ? <MetricPicker metrics={stats.metrics} value={metric} onChange={setMetric} /> : null}
      empty={empty ? t('insights.healthStats.activities.empty') : null}
    >
      {metric && effects ? (
        <>
          {side(t(`insights.healthStats.activities.higher.${metric}`), effects.lifts)}
          {side(t(`insights.healthStats.activities.lower.${metric}`), effects.lowers)}
          {more ? <Button variant="ghost" label={t(all ? 'insights.effects.less' : 'insights.effects.more')} onPress={() => setAll(!all)} /> : null}
        </>
      ) : null}
    </InsightCard>
  );
}

const styles = StyleSheet.create({
  side: { gap: spacing.xs },
});
