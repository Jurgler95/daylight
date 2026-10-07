import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { BeforeHardCard } from '@/components/insights/BeforeHardCard';
import { CoverageCard } from '@/components/insights/CoverageCard';
import { DistributionCard } from '@/components/insights/DistributionCard';
import { EffectsCard } from '@/components/insights/EffectsCard';
import { FrequencyCard } from '@/components/insights/FrequencyCard';
import { GroupCard } from '@/components/insights/GroupCard';
import { HealthCard } from '@/components/insights/HealthCard';
import { ActivityHealthCard } from '@/components/insights/health/ActivityHealthCard';
import { HealthGoalsCard } from '@/components/insights/health/HealthGoalsCard';
import { HealthLinksCard } from '@/components/insights/health/HealthLinksCard';
import { HealthRecordsCard } from '@/components/insights/health/HealthRecordsCard';
import { HealthTiles } from '@/components/insights/health/HealthTiles';
import { HealthTrendCard } from '@/components/insights/health/HealthTrendCard';
import { HealthWeekdayCard } from '@/components/insights/health/HealthWeekdayCard';
import { MoodSplitCard } from '@/components/insights/health/MoodSplitCard';
import { InsightCard } from '@/components/insights/InsightCard';
import { MonthCard } from '@/components/insights/MonthCard';
import { MoodLineChart } from '@/components/insights/MoodLineChart';
import type { ActivityNames, GroupActivities } from '@/components/insights/names';
import { PairsCard } from '@/components/insights/PairsCard';
import { PixelsCard } from '@/components/insights/PixelsCard';
import { StatTile } from '@/components/insights/StatTile';
import { StreakCard } from '@/components/insights/StreakCard';
import { SwingsCard } from '@/components/insights/SwingsCard';
import { WeekdayCard } from '@/components/insights/WeekdayCard';
import { WordsCard } from '@/components/insights/WordsCard';
import { AppText, EmptyState, Screen, Segmented, Tabs } from '@/components/ui';
import { activityLabel, levelMood } from '@/lib/catalog/catalog';
import { useCatalog } from '@/lib/catalog/useCatalog';
import { weekdayLabels, type DateString } from '@/lib/dates';
import { useToday } from '@/lib/dates/useToday';
import { formatDecimal, formatPercent, INSIGHT_RANGES, type InsightRange } from '@/lib/insights';
import { useHealthInsights, useInsights } from '@/lib/insights/useInsights';
import type { IconName } from '@/lib/icons';
import { useSelectedDayStore } from '@/lib/store/selectedDay';
import { useSettingsStore } from '@/lib/store/settingsStore';
import { useTurningPoints } from '@/lib/turning/useTurningPoints';
import { spacing } from '@/lib/theme';

/**
 * The page is split into sections, one shown at a time, so no single scroll runs through twenty
 * cards. Health and what links it to mood only appear once Health Connect delivered something.
 */
const SECTIONS = [
  { value: 'mood', icon: 'emoticon-outline' },
  { value: 'patterns', icon: 'calendar-sync-outline' },
  { value: 'activities', icon: 'shape-outline' },
  { value: 'health', icon: 'heart-pulse' },
  { value: 'links', icon: 'vector-link' },
  { value: 'notes', icon: 'notebook-outline' },
] as const satisfies readonly { value: string; icon: IconName }[];
type Section = (typeof SECTIONS)[number]['value'];
const HEALTH_SECTIONS: readonly Section[] = ['health', 'links'];

export default function InsightsScreen() {
  const { t, i18n } = useTranslation();
  const now = useToday();
  const [range, setRange] = useState<InsightRange>('90');
  const insights = useInsights(range, now);
  const health = useHealthInsights(insights, now);
  const [picked, setSection] = useState<Section>('mood');
  const sections = SECTIONS.filter((section) => health || !HEALTH_SECTIONS.includes(section.value));
  const section = sections.some((s) => s.value === picked) ? picked : 'mood';
  const catalog = useCatalog();
  const firstDay = useSettingsStore((s) => s.settings?.first_day_of_week) ?? 1;
  const pick = useSelectedDayStore((s) => s.pick);
  const turningPoints = useTurningPoints();
  const marks = useMemo(() => turningPoints.map((point) => point.date as DateString), [turningPoints]);

  const names: ActivityNames = useMemo(
    () => ({
      label: (id) => activityLabel(catalog, id),
      icon: (id) => (catalog.activityById.get(id)?.icon ?? 'tag-outline') as IconName,
    }),
    [catalog],
  );
  const groups: GroupActivities[] = useMemo(
    () =>
      catalog.groups.map((group) => ({
        id: group.id,
        name: group.name,
        activityIds: catalog.activities.filter((activity) => activity.group_id === group.id).map((activity) => activity.id),
      })),
    [catalog],
  );
  // Sunday first, like `weekdayOf`.
  const weekdayNames = useMemo(() => weekdayLabels(0), [i18n.language]); // eslint-disable-line react-hooks/exhaustive-deps
  const good = levelMood(catalog, 4).label;
  const hard = levelMood(catalog, 2).label;

  const header = (
    <View style={styles.head}>
      <AppText variant="title" accessibilityRole="header">
        {t('tabs.insights')}
      </AppText>
      {insights.allDays.length > 0 ? (
        <Tabs tabs={sections.map((s) => ({ ...s, label: t(`insights.tabs.${s.value}`) }))} value={section} onChange={setSection} />
      ) : null}
      {insights.allDays.length > 0 ? (
        <Segmented
          label={t('insights.range.label')}
          options={INSIGHT_RANGES.map((value) => ({ value, label: t(`insights.range.${value}`) }))}
          value={range}
          onChange={setRange}
        />
      ) : null}
    </View>
  );

  if (insights.allDays.length === 0) {
    return (
      <Screen sticky={header}>
        <EmptyState icon="analytics-outline" label={t('insights.empty')} />
      </Screen>
    );
  }

  const openDay = (date: DateString) => {
    pick(date === now ? null : date);
    router.navigate('/');
  };
  const empty = insights.days.length === 0;

  return (
    <Screen sticky={header} contentKey={section}>
      {section === 'mood' ? (
        <>
          {empty ? null : (
            <View style={styles.tiles}>
              <StatTile label={t('insights.tiles.mean')} value={formatDecimal(insights.mean ?? 0, 2)} hint={t('insights.days', { count: insights.days.length })} />
              {insights.coverage ? (
                <StatTile
                  label={t('insights.tiles.coverage')}
                  value={formatPercent(insights.coverage.share)}
                  hint={t('insights.tiles.coverageHint', { days: insights.coverage.days, span: insights.coverage.spanDays })}
                />
              ) : null}
            </View>
          )}
          <InsightCard title={t('insights.trend.title')} empty={empty ? t('insights.emptyRange') : null}>
            <MoodLineChart points={insights.series} window={insights.window} mean={insights.mean} iconFor={(level) => levelMood(catalog, level).icon} marks={marks} />
          </InsightCard>
          {empty ? null : <DistributionCard rows={insights.distribution} moodFor={(level) => levelMood(catalog, level)} />}
          <PixelsCard days={insights.allDays} years={insights.years} today={now} moodLabel={(level) => levelMood(catalog, level).label} onOpen={openDay} />
        </>
      ) : null}

      {section === 'patterns' ? (
        <>
          <WeekdayCard profile={insights.weekdays} names={weekdayNames} firstDay={firstDay} />
          <MonthCard months={insights.months} />
          <SwingsCard swings={insights.swings} />
          <StreakCard streaks={insights.streaks} goodLabel={good} />
        </>
      ) : null}

      {section === 'activities' ? (
        <>
          <FrequencyCard counts={insights.counts} groups={groups} names={names} />
          <EffectsCard effects={insights.effects} names={names} lag={0} />
          <EffectsCard effects={insights.nextDay} names={names} lag={1} />
          <PairsCard pairs={insights.pairs} names={names} />
          <BeforeHardCard result={insights.beforeHard} names={names} />
          <GroupCard days={insights.days} groups={groups} names={names} />
        </>
      ) : null}

      {section === 'health' && health ? (
        health.stats.metrics.length === 0 ? (
          <EmptyState icon="heart-outline" label={t('insights.healthStats.emptyRange')} />
        ) : (
          <>
            <HealthTiles stats={health.stats} />
            <HealthTrendCard stats={health.stats} window={insights.window} />
            <HealthGoalsCard stats={health.stats} />
            <HealthWeekdayCard stats={health.stats} names={weekdayNames} firstDay={firstDay} />
            <HealthRecordsCard records={health.stats.records} moodLabel={(level) => levelMood(catalog, level).label} onOpen={openDay} />
          </>
        )
      ) : null}

      {section === 'links' && health ? (
        <>
          <HealthCard mood={health.mood} />
          <MoodSplitCard splits={health.stats.moodSplits} goodLabel={good} hardLabel={hard} />
          <HealthLinksCard links={health.stats.links} />
          <ActivityHealthCard stats={health.stats} names={names} />
        </>
      ) : null}

      {section === 'notes' ? (
        <>
          <WordsCard words={insights.words} goodLabel={good} />
          <CoverageCard coverage={insights.coverage} />
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { gap: spacing.md },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
});
