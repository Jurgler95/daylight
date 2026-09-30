import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ActivityLine } from '@/components/insights/ActivityLine';
import { InsightCard } from '@/components/insights/InsightCard';
import { MoodBadge } from '@/components/mood/MoodBadge';
import { AppText, Card, Screen } from '@/components/ui';
import { MOOD_LEVELS, type MoodLevel } from '@/db/schema';
import { activityLabel, levelMood } from '@/lib/catalog/catalog';
import { useCatalog } from '@/lib/catalog/useCatalog';
import { formatPercent, type LevelActivity } from '@/lib/insights';
import { readInsightDays, useLevelDetail } from '@/lib/insights/useInsights';
import type { IconName } from '@/lib/icons';
import { useQuery } from '@/lib/store/dataVersion';
import { spacing } from '@/lib/theme';

/** One mood level over the whole diary: how often, and which activities go with it more or less than usual. */
export default function MoodInsightScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ level: string }>();
  const level = (MOOD_LEVELS.find((candidate) => String(candidate) === params.level) ?? 3) as MoodLevel;
  const catalog = useCatalog();
  const detail = useLevelDetail(level);
  const total = useQuery(() => readInsightDays().length, []);
  const mood = levelMood(catalog, level);

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

  return (
    <Screen back title={mood.label}>
      <Card>
        <View style={styles.head}>
          <MoodBadge level={level} icon={mood.icon} size={48} />
          <AppText style={styles.text}>
            {detail.days ? t('insights.level.days', { count: detail.days, total, share: formatPercent(detail.share) }) : t('insights.level.noDays')}
          </AppText>
        </View>
      </Card>
      {detail.days ? (
        <>
          <InsightCard title={t('insights.level.typical')}>{rows(detail.typical)}</InsightCard>
          <InsightCard title={t('insights.level.rare')}>{rows(detail.rare)}</InsightCard>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  text: { flex: 1 },
});
