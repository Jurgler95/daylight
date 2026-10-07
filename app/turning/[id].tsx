import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, View } from 'react-native';

import { ActivityLine } from '@/components/insights/ActivityLine';
import { InsightCard } from '@/components/insights/InsightCard';
import { LevelBar } from '@/components/insights/LevelBar';
import { MoodLineChart } from '@/components/insights/MoodLineChart';
import { StatTile } from '@/components/insights/StatTile';
import { TurningHero } from '@/components/turning/TurningHero';
import { AppText, Button, Card, EmptyState, ListRow, Screen, Segmented } from '@/components/ui';
import { getDb } from '@/db';
import { deleteTurningPoint, getTurningPoint } from '@/db/repositories/turningPoints';
import { activityLabel, levelMood } from '@/lib/catalog/catalog';
import { useCatalog } from '@/lib/catalog/useCatalog';
import { formatShortWithYear, type DateString } from '@/lib/dates';
import { useToday } from '@/lib/dates/useToday';
import { formatMetric } from '@/lib/health/format';
import { formatDecimal, formatPercent, formatSigned, moodSeries } from '@/lib/insights';
import { readInsightDays } from '@/lib/insights/useInsights';
import type { IconName } from '@/lib/icons';
import { mutate, useQuery } from '@/lib/store/dataVersion';
import { spacing } from '@/lib/theme';
import { MIN_SIDE_DAYS, TURNING_SPANS, type TurningSpan } from '@/lib/turning/compare';
import { useTurningComparison } from '@/lib/turning/useTurningPoints';

/** One turning point on its own: the days before it against the same number of days after it. */
export default function TurningPointDetailScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const today = useToday();
  const catalog = useCatalog();
  const point = useQuery(() => getTurningPoint(getDb(), Number(id)), [id]);
  const [span, setSpan] = useState<TurningSpan>('90');
  const date = (point?.date ?? null) as DateString | null;
  const comparison = useTurningComparison(date, span, today);
  const days = useQuery(() => readInsightDays(), []);
  const series = useQuery(
    () => (comparison?.before && comparison.after ? moodSeries(readInsightDays(), { from: comparison.before.from, to: comparison.after.to }) : []),
    [comparison],
  );

  if (!point || !date || !comparison) {
    return (
      <Screen back title={t('turning.title')}>
        <EmptyState icon="flag-outline" label={t('turning.gone')} />
      </Screen>
    );
  }

  const moodLabel = (level: Parameters<typeof levelMood>[1]) => levelMood(catalog, level).label;
  const { before, after, enough, beforeMean, afterMean } = comparison;
  const remove = () =>
    Alert.alert(t('turning.deleteTitle'), t('turning.deleteText', { title: point.title }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('turning.delete'),
        style: 'destructive',
        onPress: () => {
          mutate(() => deleteTurningPoint(getDb(), point.id));
          router.back();
        },
      },
    ]);

  return (
    <Screen back>
      <TurningHero title={point.title} date={date} days={days} />
      <Card>
        {point.note ? <AppText>{point.note}</AppText> : null}
        <Button variant="secondary" label={t('turning.edit')} onPress={() => router.push({ pathname: '/turning/new', params: { id: String(point.id) } })} />
      </Card>

      <Segmented
        label={t('turning.span.label')}
        options={TURNING_SPANS.map((value) => ({ value, label: t(`turning.span.${value}`) }))}
        value={span}
        onChange={setSpan}
      />

      {!enough || !before || !after || beforeMean === null || afterMean === null ? (
        <Card>
          <AppText muted>
            {comparison.length === 0
              ? t('turning.tooSoon')
              : t('turning.few', { before: comparison.beforeDays, after: comparison.afterDays, min: MIN_SIDE_DAYS })}
          </AppText>
        </Card>
      ) : (
        <>
          <View style={styles.tiles}>
            <StatTile label={t('turning.before')} value={formatDecimal(beforeMean, 2)} hint={t('turning.daysWithEntries', { count: comparison.beforeDays })} />
            <StatTile
              label={t('turning.after')}
              value={formatDecimal(afterMean, 2)}
              hint={`${formatSigned(afterMean - beforeMean, 2)} · ${t('turning.daysWithEntries', { count: comparison.afterDays })}`}
            />
          </View>
          <Card tone="muted">
            <AppText>
              {t('turning.sentence', {
                count: comparison.length,
                after: formatDecimal(afterMean),
                before: formatDecimal(beforeMean),
              })}
            </AppText>
            <AppText variant="caption" muted>
              {t('turning.windows', {
                beforeFrom: formatShortWithYear(before.from),
                beforeTo: formatShortWithYear(before.to),
                afterFrom: formatShortWithYear(after.from),
                afterTo: formatShortWithYear(after.to),
              })}
            </AppText>
            {comparison.seasons ? (
              <AppText variant="caption" muted>
                {t('turning.seasons')}
              </AppText>
            ) : null}
            <AppText variant="caption" muted>
              {t('turning.noCause')}
            </AppText>
          </Card>

          <InsightCard title={t('turning.trend')}>
            <MoodLineChart
              points={series}
              window={{ from: before.from, to: after.to }}
              mean={null}
              iconFor={(level) => levelMood(catalog, level).icon}
              marks={[date]}
            />
          </InsightCard>

          <InsightCard title={t('turning.levels')}>
            <LevelBar label={t('turning.beforeShort')} levels={comparison.distribution.before} moodLabel={moodLabel} />
            <LevelBar label={t('turning.afterShort')} levels={comparison.distribution.after} moodLabel={moodLabel} />
          </InsightCard>

          <InsightCard title={t('turning.activities')} empty={comparison.activities.length === 0 ? t('turning.activitiesSame') : null}>
            {comparison.activities.map((row) => (
              <ActivityLine
                key={row.activityId}
                activityId={row.activityId}
                icon={(catalog.activityById.get(row.activityId)?.icon ?? 'tag-outline') as IconName}
                title={activityLabel(catalog, row.activityId)}
                detail={t('turning.activityShift', { before: formatPercent(row.beforeShare), after: formatPercent(row.afterShare) })}
              />
            ))}
          </InsightCard>

          {comparison.health.length > 0 ? (
            <InsightCard title={t('turning.health')}>
              {comparison.health.map((row) => (
                <View key={row.metric} style={styles.healthRow} accessible>
                  <AppText variant="label" style={styles.flex}>
                    {t(`insights.healthStats.metric.${row.metric}`)}
                  </AppText>
                  <AppText muted>{t('turning.healthShift', { before: formatMetric(row.metric, row.before), after: formatMetric(row.metric, row.after) })}</AppText>
                </View>
              ))}
            </InsightCard>
          ) : null}
        </>
      )}

      <Card>
        <ListRow icon="trash-outline" label={t('turning.delete')} destructive onPress={remove} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  healthRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 32 },
  flex: { flex: 1 },
});
