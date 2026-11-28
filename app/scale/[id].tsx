import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ScaleActivitiesCard } from '@/components/insights/scales/ScaleActivitiesCard';
import { ScaleMoodCard } from '@/components/insights/scales/ScaleMoodCard';
import { ScaleTrendCard } from '@/components/insights/scales/ScaleTrendCard';
import { ScaleWeekdayCard } from '@/components/insights/scales/ScaleWeekdayCard';
import { ScaleWordsCard } from '@/components/insights/scales/ScaleWordsCard';
import type { ActivityNames } from '@/components/insights/names';
import { StatTile } from '@/components/insights/StatTile';
import { Button, Card, EmptyState, Screen, Segmented } from '@/components/ui';
import { activityLabel } from '@/lib/catalog/catalog';
import { useCatalog } from '@/lib/catalog/useCatalog';
import { weekdayLabels } from '@/lib/dates';
import { useToday } from '@/lib/dates/useToday';
import { INSIGHT_RANGES, type InsightRange } from '@/lib/insights';
import { useInsights, useScaleInsights, useScaleWords } from '@/lib/insights/useInsights';
import type { IconName } from '@/lib/icons';
import { formatScaleValue } from '@/lib/scales/format';
import { useSettingsStore } from '@/lib/store/settingsStore';
import { spacing } from '@/lib/theme';

/**
 * Everything on record about one scale, like the page of an activity. Opened from the list at the
 * end of "Skalen" with the range picked there, which can be changed here.
 */
export default function ScaleInsightScreen() {
  const { t, i18n } = useTranslation();
  const params = useLocalSearchParams<{ id: string; range?: string }>();
  const scaleId = Number(params.id);
  const [range, setRange] = useState<InsightRange>(INSIGHT_RANGES.find((value) => value === params.range) ?? '90');
  const now = useToday();
  const insights = useInsights(range, now);
  const catalog = useCatalog();
  const scale = catalog.scaleById.get(scaleId);
  const scales = useMemo(() => (scale ? [scale] : []), [scale]);
  const insight = useScaleInsights(insights, scales)[0] ?? null;
  const words = useScaleWords(insights, scale);
  const firstDay = useSettingsStore((s) => s.settings?.first_day_of_week) ?? 1;
  const weekdayNames = useMemo(() => weekdayLabels(0), [i18n.language]); // eslint-disable-line react-hooks/exhaustive-deps
  const names: ActivityNames = useMemo(
    () => ({
      label: (id) => activityLabel(catalog, id),
      icon: (id) => (catalog.activityById.get(id)?.icon ?? 'tag-outline') as IconName,
    }),
    [catalog],
  );

  if (!scale) {
    return (
      <Screen back title={t('manage.scales')}>
        <EmptyState icon="help-circle-outline" label={t('manage.gone')} />
      </Screen>
    );
  }

  const summary = insight?.summary;
  return (
    <Screen back title={scale.name}>
      <Card>
        <Segmented
          label={t('insights.range.label')}
          options={INSIGHT_RANGES.map((value) => ({ value, label: t(`insights.range.${value}`) }))}
          value={range}
          onChange={setRange}
        />
        <Button
          variant="secondary"
          label={t('insights.scales.detail.edit')}
          onPress={() => router.push({ pathname: '/more/scale/[id]', params: { id: String(scale.id) } })}
        />
      </Card>
      {insight && summary ? (
        <>
          <View style={styles.tiles}>
            <StatTile
              label={t('insights.tiles.mean')}
              value={formatScaleValue(scale, summary.mean)}
              hint={
                summary.previousMean !== null
                  ? t('insights.healthStats.tiles.before', { value: formatScaleValue(scale, summary.previousMean) })
                  : t('insights.healthStats.tiles.days', { count: summary.days })
              }
            />
            <StatTile label={t('insights.scales.detail.median')} value={formatScaleValue(scale, summary.median)} />
            <StatTile
              label={t('insights.scales.detail.span')}
              value={t('insights.scales.detail.spanValue', { min: formatScaleValue(scale, summary.min), max: formatScaleValue(scale, summary.max) })}
            />
            <StatTile label={t('insights.scales.detail.days')} value={String(summary.days)} />
          </View>
          <ScaleTrendCard insight={insight} window={insights.window} />
          <ScaleMoodCard insight={insight} />
          <ScaleActivitiesCard insight={insight} names={names} />
          <ScaleWeekdayCard insight={insight} names={weekdayNames} firstDay={firstDay} />
          {words ? <ScaleWordsCard scale={scale} words={words} /> : null}
        </>
      ) : (
        <EmptyState icon="options-outline" label={t('insights.scales.detail.empty')} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
});
