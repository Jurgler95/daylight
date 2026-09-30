import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import type { ActivityCount } from '@/lib/insights';
import { spacing } from '@/lib/theme';

import { ActivityLine } from './ActivityLine';
import { InsightCard } from './InsightCard';
import type { ActivityNames, GroupActivities } from './names';

/** Activities named per group. */
const PER_GROUP = 4;

/** The most frequent activities of each group in the window, with the count of the window before. */
export function FrequencyCard({ counts, groups, names }: { counts: ActivityCount[]; groups: GroupActivities[]; names: ActivityNames }) {
  const { t } = useTranslation();
  const byId = new Map(counts.map((count) => [count.activityId, count]));
  const sections = groups
    .map((group) => ({
      group,
      rows: group.activityIds
        .flatMap((id) => {
          const count = byId.get(id);
          return count && count.days > 0 ? [count] : [];
        })
        .sort((a, b) => b.days - a.days)
        .slice(0, PER_GROUP),
    }))
    .filter((section) => section.rows.length > 0);

  return (
    <InsightCard title={t('insights.frequency.title')} empty={sections.length === 0 ? t('insights.frequency.empty') : null}>
      {sections.map(({ group, rows }) => (
        <View key={group.id} style={styles.group}>
          <AppText variant="caption" muted>
            {group.name.toUpperCase()}
          </AppText>
          {rows.map((row) => (
            <ActivityLine
              key={row.activityId}
              activityId={row.activityId}
              icon={names.icon(row.activityId)}
              title={names.label(row.activityId)}
              detail={
                row.previousDays === null
                  ? t('insights.days', { count: row.days })
                  : `${t('insights.days', { count: row.days })}, ${t('insights.frequency.before', { count: row.previousDays })}`
              }
            />
          ))}
        </View>
      ))}
    </InsightCard>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.xs },
});
