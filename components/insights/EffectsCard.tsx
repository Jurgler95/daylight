import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText, Button } from '@/components/ui';
import { formatDecimal, type ActivityEffect, type SplitEffects } from '@/lib/insights';
import { spacing } from '@/lib/theme';

import { ActivityLine } from './ActivityLine';
import { InsightCard } from './InsightCard';
import type { ActivityNames } from './names';

/** Rows per side before "Alle zeigen". */
const SHOWN = 4;

interface Props {
  effects: SplitEffects;
  names: ActivityNames;
  /** 1 for "Am Folgetag": the mood of the day after. */
  lag: 0 | 1;
}

/**
 * Mood on days with an activity against days without, split into higher and lower. Sorted by
 * the shrunk difference, worded as what happened on those days, never as a cause.
 */
export function EffectsCard({ effects, names, lag }: Props) {
  const { t } = useTranslation();
  const [all, setAll] = useState(false);
  const sentence = (effect: ActivityEffect) =>
    t(lag ? 'insights.effects.nextSentence' : 'insights.effects.sentence', {
      name: names.label(effect.activityId),
      with: formatDecimal(effect.withMean),
      without: formatDecimal(effect.withoutMean),
      count: effect.withDays,
    });
  const side = (title: string, list: ActivityEffect[]) =>
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
  const more = effects.lifts.length > SHOWN || effects.lowers.length > SHOWN;
  const empty = effects.lifts.length + effects.lowers.length === 0;

  return (
    <InsightCard title={t(lag ? 'insights.effects.nextTitle' : 'insights.effects.title')} empty={empty ? t('insights.effects.empty') : null}>
      {side(t('insights.effects.higher'), effects.lifts)}
      {side(t('insights.effects.lower'), effects.lowers)}
      {more ? <Button variant="ghost" label={t(all ? 'insights.effects.less' : 'insights.effects.more')} onPress={() => setAll(!all)} /> : null}
    </InsightCard>
  );
}

const styles = StyleSheet.create({
  side: { gap: spacing.xs },
});
