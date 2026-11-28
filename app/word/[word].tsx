import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { ActivityLine } from '@/components/insights/ActivityLine';
import { DayList } from '@/components/insights/DayList';
import { InsightCard } from '@/components/insights/InsightCard';
import { LevelBar } from '@/components/insights/LevelBar';
import { ScaleCompareCard } from '@/components/insights/scales/ScaleCompareCard';
import { AppText, Card, EmptyState, Screen } from '@/components/ui';
import { activityLabel, levelMood } from '@/lib/catalog/catalog';
import { useCatalog } from '@/lib/catalog/useCatalog';
import type { DateString } from '@/lib/dates';
import { formatDecimal, formatPercent, type LevelActivity } from '@/lib/insights';
import { useWordDetail } from '@/lib/insights/useInsights';
import type { IconName } from '@/lib/icons';
import { useSelectedDayStore } from '@/lib/store/selectedDay';

/**
 * One word from the notes over the whole diary, like the page of an activity: the mood, the scales
 * and the activities on days whose note contains it, against the other days with a note.
 */
export default function WordInsightScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ word: string }>();
  const catalog = useCatalog();
  const detail = useWordDetail(params.word ?? '', catalog.scales);
  const pick = useSelectedDayStore((s) => s.pick);
  const moodFor = (level: Parameters<typeof levelMood>[1]) => levelMood(catalog, level);
  const open = (date: DateString) => {
    pick(date);
    router.navigate('/');
  };

  const rows = (list: LevelActivity[]) =>
    list.length === 0 ? (
      <AppText muted>{t('insights.level.none')}</AppText>
    ) : (
      list.map((row) => (
        <ActivityLine
          key={row.activityId}
          activityId={row.activityId}
          icon={(catalog.activityById.get(row.activityId)?.icon ?? 'tag-outline') as IconName}
          title={activityLabel(catalog, row.activityId)}
          detail={t('insights.level.row', { share: formatPercent(row.share), other: formatPercent(row.otherShare) })}
        />
      ))
    );

  if (detail.days.length === 0) {
    return (
      <Screen back title={detail.word}>
        <EmptyState icon="document-text-outline" label={t('insights.word.noDays')} />
      </Screen>
    );
  }

  const enough = detail.withMean !== null && detail.withoutMean !== null;
  return (
    <Screen back title={detail.word} eyebrow={t('insights.word.eyebrow')}>
      <Card>
        <AppText>{t('insights.word.days', { count: detail.days.length, total: detail.noteDays, share: formatPercent(detail.share) })}</AppText>
        <AppText variant="caption" muted>
          {t('insights.word.basis')}
        </AppText>
      </Card>
      <InsightCard title={t('insights.activity.levels')}>
        <LevelBar label={t('insights.activity.with')} levels={detail.withLevels} moodLabel={(level) => moodFor(level).label} />
        <LevelBar label={t('insights.activity.without')} levels={detail.withoutLevels} moodLabel={(level) => moodFor(level).label} />
        {enough ? (
          <AppText>{t('insights.word.mood', { word: detail.word, with: formatDecimal(detail.withMean!), without: formatDecimal(detail.withoutMean!) })}</AppText>
        ) : (
          <AppText muted>{t('insights.activity.few')}</AppText>
        )}
      </InsightCard>
      <ScaleCompareCard comparisons={detail.scales} />
      <InsightCard title={t('insights.level.typical')}>{rows(detail.activities.typical)}</InsightCard>
      <InsightCard title={t('insights.level.rare')}>{rows(detail.activities.rare)}</InsightCard>
      <InsightCard title={t('insights.activity.allDays')}>
        <DayList days={detail.days} moodFor={moodFor} onOpen={open} />
      </InsightCard>
    </Screen>
  );
}
