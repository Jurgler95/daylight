import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ActivityLine } from '@/components/insights/ActivityLine';
import { InsightCard } from '@/components/insights/InsightCard';
import type { ActivityNames } from '@/components/insights/names';
import { AppText, Button } from '@/components/ui';
import type { ActivityHealthEffect, ScaleInsight } from '@/lib/insights';
import { formatScaleValue } from '@/lib/scales/format';
import { spacing } from '@/lib/theme';

/** Rows per side before "Alle zeigen". */
const SHOWN = 4;

/** The scale on days with an activity against days without, like the mood effects. */
export function ScaleActivitiesCard({ insight, names }: { insight: ScaleInsight; names: ActivityNames }) {
  const { t } = useTranslation();
  const [all, setAll] = useState(false);
  const { scale, activities } = insight;
  const sentence = (effect: ActivityHealthEffect) =>
    t('insights.healthStats.activities.sentence', { with: formatScaleValue(scale, effect.withMean), without: formatScaleValue(scale, effect.withoutMean), count: effect.withDays });
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
  const more = activities.lifts.length > SHOWN || activities.lowers.length > SHOWN;

  return (
    <InsightCard
      title={t('insights.scales.activities.title')}
      empty={activities.lifts.length + activities.lowers.length === 0 ? t('insights.healthStats.activities.empty') : null}
    >
      {side(t('insights.scales.activities.higher', { scale: scale.name }), activities.lifts)}
      {side(t('insights.scales.activities.lower', { scale: scale.name }), activities.lowers)}
      {more ? <Button variant="ghost" label={t(all ? 'insights.effects.less' : 'insights.effects.more')} onPress={() => setAll(!all)} /> : null}
    </InsightCard>
  );
}

const styles = StyleSheet.create({
  side: { gap: spacing.xs },
});
