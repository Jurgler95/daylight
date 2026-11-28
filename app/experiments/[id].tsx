import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, View } from 'react-native';

import { ActivityLine } from '@/components/insights/ActivityLine';
import { InsightCard } from '@/components/insights/InsightCard';
import { LevelBar } from '@/components/insights/LevelBar';
import { MoodLineChart } from '@/components/insights/MoodLineChart';
import { StatTile } from '@/components/insights/StatTile';
import { ValueRow } from '@/components/insights/ValueRow';
import { AppText, Button, Card, EmptyState, ListRow, Screen } from '@/components/ui';
import { getDb } from '@/db';
import { deleteExperiment, endExperiment, markExperimentSeen } from '@/db/repositories/experiments';
import type { Experiment } from '@/db/schema';
import { activityLabel, levelMood } from '@/lib/catalog/catalog';
import { useCatalog } from '@/lib/catalog/useCatalog';
import { formatLong, formatRange, formatShortWithYear, type DateString } from '@/lib/dates';
import { useToday } from '@/lib/dates/useToday';
import type { CheckInCounts, ExperimentComparison } from '@/lib/experiments/compare';
import { canEndEarly, endOnDayBefore } from '@/lib/experiments/rules';
import { useExperiment, useExperimentComparison } from '@/lib/experiments/useExperiments';
import { experimentStatus, verdictSentences, verdictShort } from '@/lib/experiments/view';
import { formatMetric } from '@/lib/health/format';
import { formatDecimal, formatPercent, formatSigned, moodSeries, windowLength } from '@/lib/insights';
import { readInsightDays } from '@/lib/insights/useInsights';
import type { IconName } from '@/lib/icons';
import { formatScaleValue } from '@/lib/scales/format';
import { mutate, useQuery } from '@/lib/store/dataVersion';
import { spacing } from '@/lib/theme';
import { MIN_SIDE_DAYS } from '@/lib/turning/compare';

/**
 * One experiment: the days before it next to the days in it. Numbers and the course show at once;
 * whether a difference goes beyond the usual ups and downs only once it is over.
 */
export default function ExperimentDetailScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const today = useToday();
  const experiment = useExperiment(Number(id));
  const result = useExperimentComparison(Number(id), today);
  const over = !!result && result.comparison.state === 'over';

  // Seen once it is over and opened: in an effect, and only while still unseen, or every visit
  // would write and read everything again.
  const unseen = over && experiment?.result_seen === false;
  useEffect(() => {
    if (unseen && experiment) mutate(() => markExperimentSeen(getDb(), experiment.id));
  }, [unseen, experiment]);

  if (!experiment || !result) {
    return (
      <Screen back title={t('experiments.one')} backLabel={t('common.back')}>
        <EmptyState icon="flask-outline" label={t('experiments.gone')} />
      </Screen>
    );
  }

  const comparison = result.comparison;
  const endDate = endOnDayBefore(experiment, today);
  // "Jetzt beenden" removes the answers after the new end, today's among them; it says so first.
  const dropsAnswers = result.checkIn.lastAnswered !== null && result.checkIn.lastAnswered > endDate;
  const end = () =>
    Alert.alert(t('experiments.endTitle'), t(dropsAnswers ? 'experiments.endTextAnswers' : 'experiments.endText', { title: experiment.title, date: formatLong(endDate) }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('experiments.endConfirm'), style: 'destructive', onPress: () => mutate(() => endExperiment(getDb(), experiment.id, today)) },
    ]);
  const remove = () =>
    Alert.alert(t('experiments.deleteTitle'), t('experiments.deleteText', { title: experiment.title }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('experiments.delete'),
        style: 'destructive',
        onPress: () => {
          mutate(() => deleteExperiment(getDb(), experiment.id));
          router.back();
        },
      },
    ]);

  return (
    <Screen back eyebrow={t('experiments.one')} title={experiment.title} backLabel={t('common.back')}>
      <Head experiment={experiment} today={today} />
      <Body experiment={experiment} comparison={comparison} />
      {comparison.state !== 'planned' && (experiment.check_in || result.checkIn.answered > 0) ? <CheckInBlock counts={result.checkIn} over={comparison.state === 'over'} /> : null}
      <Card>
        <ListRow
          icon="create-outline"
          label={t('experiments.edit')}
          onPress={() => router.push({ pathname: '/experiments/new', params: { id: String(experiment.id) } })}
        />
        {canEndEarly(experiment, today) ? <ListRow icon="stop-circle-outline" label={t('experiments.end')} onPress={end} /> : null}
        <ListRow icon="trash-outline" label={t('experiments.delete')} destructive onPress={remove} />
      </Card>
    </Screen>
  );
}

function Head({ experiment, today }: { experiment: Experiment; today: DateString }) {
  const { t } = useTranslation();
  const status = experimentStatus(t, experiment, today);
  return (
    <Card>
      <AppText variant="label">{formatRange(experiment.start_date as DateString, experiment.end_date as DateString)}</AppText>
      <AppText muted>{status}</AppText>
      {experiment.note ? <AppText>{experiment.note}</AppText> : null}
    </Card>
  );
}

/** The comparison itself, or one honest line why there is none yet. */
function Body({ experiment, comparison }: { experiment: Experiment; comparison: ExperimentComparison }) {
  const { t } = useTranslation();
  const catalog = useCatalog();
  const { before, during, mood } = comparison;
  const series = useQuery(
    () => (before && during && comparison.enough ? moodSeries(readInsightDays(), { from: before.from, to: during.to }) : []),
    [comparison],
  );

  if (comparison.state === 'planned') {
    return (
      <Card tone="muted">
        <AppText muted>{t('experiments.planned', { date: formatLong(experiment.start_date as DateString) })}</AppText>
      </Card>
    );
  }
  if (comparison.tooShort) {
    return (
      <Card tone="muted">
        <AppText muted>{t('experiments.tooShort', { count: comparison.total, min: MIN_SIDE_DAYS })}</AppText>
      </Card>
    );
  }
  if (!comparison.enough || !before || !during || !mood) {
    return (
      <Card tone="muted">
        <AppText muted>
          {before
            ? t(comparison.state === 'over' ? 'experiments.fewOver' : 'experiments.few', {
                before: comparison.beforeDays,
                during: comparison.duringDays,
                min: MIN_SIDE_DAYS,
              })
            : t('experiments.noBefore')}
        </AppText>
      </Card>
    );
  }

  const over = comparison.state === 'over';
  const moodLabel = (level: Parameters<typeof levelMood>[1]) => levelMood(catalog, level).label;
  const titles = (list: readonly { title: string }[]) => list.map((other) => other.title).join(', ');

  return (
    <>
      <View style={styles.tiles}>
        <StatTile label={t('experiments.before')} value={formatDecimal(mood.before, 2)} hint={t('experiments.daysWithEntries', { count: comparison.beforeDays })} />
        <StatTile
          label={t('experiments.during')}
          value={formatDecimal(mood.during, 2)}
          hint={`${formatSigned(mood.during - mood.before, 2)} · ${t('experiments.daysWithEntries', { count: comparison.duringDays })}`}
        />
      </View>
      <Card tone="muted">
        <AppText>
          {over
            ? t('experiments.sentence', { count: windowLength(before), during: formatDecimal(mood.during), before: formatDecimal(mood.before) })
            : t('experiments.sentenceRunning', {
                elapsed: comparison.elapsed,
                total: comparison.total,
                during: formatDecimal(mood.during),
                before: formatDecimal(mood.before),
              })}
        </AppText>
        {over ? verdictSentences(t, mood.verdict).map((line) => <AppText key={line}>{line}</AppText>) : <AppText>{t('experiments.interim')}</AppText>}
        <AppText variant="caption" muted>
          {t('experiments.windows', {
            beforeFrom: formatShortWithYear(before.from),
            beforeTo: formatShortWithYear(before.to),
            duringFrom: formatShortWithYear(during.from),
            duringTo: formatShortWithYear(during.to),
          })}
        </AppText>
        {comparison.overlapDuring.length > 0 ? (
          <AppText variant="caption" muted>
            {t('experiments.overlapDuring', { titles: titles(comparison.overlapDuring) })}
          </AppText>
        ) : null}
        {comparison.overlapBefore.length > 0 ? (
          <AppText variant="caption" muted>
            {t('experiments.overlapBefore', { titles: titles(comparison.overlapBefore) })}
          </AppText>
        ) : null}
        {comparison.seasons ? (
          <AppText variant="caption" muted>
            {t('experiments.seasons')}
          </AppText>
        ) : null}
        {comparison.regression ? (
          <AppText variant="caption" muted>
            {t('experiments.regression')}
          </AppText>
        ) : null}
        {comparison.judged > 1 ? (
          <AppText variant="caption" muted>
            {t('experiments.noise.many')}
          </AppText>
        ) : null}
        <AppText variant="caption" muted>
          {t('experiments.noCause')}
        </AppText>
      </Card>

      <InsightCard title={t('experiments.trend')}>
        <MoodLineChart
          points={series}
          window={{ from: before.from, to: during.to }}
          mean={null}
          iconFor={(level) => levelMood(catalog, level).icon}
          marks={[during.from]}
          title={t('experiments.trend')}
        />
      </InsightCard>

      <InsightCard title={t('experiments.levels')}>
        <LevelBar label={t('experiments.before')} levels={comparison.distribution.before} moodLabel={moodLabel} labelAbove />
        <LevelBar label={t('experiments.during')} levels={comparison.distribution.during} moodLabel={moodLabel} labelAbove />
      </InsightCard>

      {comparison.scales.length > 0 ? (
        <InsightCard title={t('experiments.scales')}>
          {comparison.scales.map((row) => {
            const scale = catalog.scaleById.get(row.scaleId);
            if (!scale) return null;
            const shift = t('experiments.shift', { before: formatScaleValue(scale, row.before), during: formatScaleValue(scale, row.during) });
            return <ValueRow key={row.scaleId} label={scale.name} detail={shift} note={verdictShort(t, row.verdict)} />;
          })}
        </InsightCard>
      ) : null}

      {comparison.health.length > 0 ? (
        <InsightCard title={t('experiments.health')}>
          {comparison.health.map((row) => {
            const shift = t('experiments.shift', { before: formatMetric(row.metric, row.before), during: formatMetric(row.metric, row.after) });
            return <ValueRow key={row.metric} label={t(`insights.healthStats.metric.${row.metric}`)} detail={shift} note={verdictShort(t, row.verdict)} />;
          })}
        </InsightCard>
      ) : null}

      <InsightCard title={t('experiments.activities')} empty={comparison.activities.length === 0 ? t('experiments.activitiesSame') : null}>
        {comparison.activities.map((row) => (
          <ActivityLine
            key={row.activityId}
            activityId={row.activityId}
            icon={(catalog.activityById.get(row.activityId)?.icon ?? 'tag-outline') as IconName}
            title={activityLabel(catalog, row.activityId)}
            detail={t('experiments.activityShift', { before: formatPercent(row.beforeShare), during: formatPercent(row.afterShare) })}
          />
        ))}
        {comparison.activities.length > 0 ? (
          <AppText variant="caption" muted>
            {t('experiments.activitiesNoVerdict')}
          </AppText>
        ) : null}
      </InsightCard>
    </>
  );
}

/** How often it was kept, by the answers in the entry editor. No comparison of the days with yes against those with no. */
function CheckInBlock({ counts, over }: { counts: CheckInCounts; over: boolean }) {
  const { t } = useTranslation();
  return (
    <InsightCard title={t('experiments.checkIn.title')}>
      <AppText>
        {counts.answered > 0
          ? t('experiments.checkIn.count', { count: counts.answered, kept: counts.kept })
          : t(over ? 'experiments.checkIn.noneOver' : 'experiments.checkIn.none')}
      </AppText>
      {counts.endedByNo ? (
        <AppText muted>{t('experiments.checkIn.endedByNo', { date: formatLong(counts.endedByNo) })}</AppText>
      ) : null}
    </InsightCard>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
});
