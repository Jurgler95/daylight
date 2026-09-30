import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { ActivityLine } from '@/components/insights/ActivityLine';
import { DayList } from '@/components/insights/DayList';
import { InsightCard } from '@/components/insights/InsightCard';
import { LevelBar } from '@/components/insights/LevelBar';
import { MiniBars } from '@/components/insights/MiniBars';
import { AppText, Button, Card, EmptyState, Screen } from '@/components/ui';
import { activityLabel, levelMood } from '@/lib/catalog/catalog';
import { useCatalog } from '@/lib/catalog/useCatalog';
import { formatMonthLong, formatMonthNarrow, weekdayLabels, type DateString } from '@/lib/dates';
import { formatDecimal, formatPercent, orderWeekdays, type ActivityEffect } from '@/lib/insights';
import { readInsightDays, useActivityDetail } from '@/lib/insights/useInsights';
import type { IconName } from '@/lib/icons';
import { useQuery } from '@/lib/store/dataVersion';
import { useSelectedDayStore } from '@/lib/store/selectedDay';
import { useSettingsStore } from '@/lib/store/settingsStore';

/** Everything on record about one activity, over the whole diary. Reached from every insight card and from the management. */
export default function ActivityInsightScreen() {
  const { t, i18n } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const activityId = Number(id);
  const catalog = useCatalog();
  const detail = useActivityDetail(activityId);
  const total = useQuery(() => readInsightDays().length, []);
  const firstDay = useSettingsStore((s) => s.settings?.first_day_of_week) ?? 1;
  const pick = useSelectedDayStore((s) => s.pick);
  const names = useMemo(() => weekdayLabels(0), [i18n.language]); // eslint-disable-line react-hooks/exhaustive-deps
  const activity = catalog.activityById.get(activityId);

  if (!activity) {
    return (
      <Screen back title={t('insights.activity.insights')}>
        <EmptyState icon="help-circle-outline" label={t('manage.gone')} />
      </Screen>
    );
  }

  const label = activityLabel(catalog, activityId);
  const group = catalog.groups.find((candidate) => candidate.id === activity.group_id);
  const moodFor = (level: Parameters<typeof levelMood>[1]) => levelMood(catalog, level);
  const sentence = (key: string, effect: ActivityEffect | null) =>
    effect ? t(key, { name: label, with: formatDecimal(effect.withMean), without: formatDecimal(effect.withoutMean), count: effect.withDays }) : null;
  const same = sentence('insights.effects.sentence', detail.sameDay);
  const next = sentence('insights.effects.nextSentence', detail.nextDay);
  const weekdays = orderWeekdays(detail.weekdays, firstDay);
  const peakMonth = Math.max(1, ...detail.months.map((month) => month.days));
  const open = (date: DateString) => {
    pick(date);
    router.navigate('/');
  };

  return (
    <Screen back title={label} eyebrow={group?.name}>
      <Card>
        <AppText>{t('insights.activity.days', { count: detail.days.length, total, share: formatPercent(detail.share) })}</AppText>
        <Button variant="secondary" label={t('insights.activity.edit')} onPress={() => router.push({ pathname: '/more/activity/[id]', params: { id: String(activityId) } })} />
      </Card>
      {detail.days.length === 0 ? null : (
        <>
          <InsightCard title={t('insights.activity.levels')}>
            <LevelBar label={t('insights.activity.with')} levels={detail.withLevels} moodLabel={(level) => moodFor(level).label} />
            <LevelBar label={t('insights.activity.without')} levels={detail.withoutLevels} moodLabel={(level) => moodFor(level).label} />
            {same ? <AppText>{same}</AppText> : null}
            {next ? <AppText>{next}</AppText> : null}
            {!same && !next ? <AppText muted>{t('insights.activity.few')}</AppText> : null}
          </InsightCard>
          <InsightCard title={t('insights.activity.weekdays')}>
            <MiniBars
              values={weekdays.map((day) => day.share)}
              labels={weekdays.map((day) => names[day.weekday] ?? '')}
              accessibilityLabel={weekdays.map((day) => `${names[day.weekday]}: ${day.days}, ${formatPercent(day.share)}`).join('. ')}
            />
          </InsightCard>
          <InsightCard title={t('insights.activity.companions')} empty={detail.companions.length === 0 ? t('insights.activity.few') : null}>
            {detail.companions.map((companion) => (
              <ActivityLine
                key={companion.activityId}
                activityId={companion.activityId}
                icon={(catalog.activityById.get(companion.activityId)?.icon ?? 'tag-outline') as IconName}
                title={activityLabel(catalog, companion.activityId)}
                detail={t('insights.activity.companion', { count: companion.days, share: formatPercent(companion.share) })}
              />
            ))}
          </InsightCard>
          <InsightCard title={t('insights.activity.months')}>
            <MiniBars
              values={detail.months.map((month) => month.days / peakMonth)}
              labels={detail.months.map((month, i) => (detail.months.length <= 12 || i % 3 === 0 ? formatMonthNarrow(month.month) : ''))}
              accessibilityLabel={detail.months.map((month) => `${formatMonthLong(month.month)} ${month.month.slice(0, 4)}: ${month.days}`).join('. ')}
            />
          </InsightCard>
          <InsightCard title={t('insights.activity.allDays')}>
            <DayList days={detail.days} moodFor={moodFor} onOpen={open} />
          </InsightCard>
        </>
      )}
      {detail.days.length === 0 ? <EmptyState icon="calendar-outline" label={t('insights.activity.noDays')} /> : null}
    </Screen>
  );
}
