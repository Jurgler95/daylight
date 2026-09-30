import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText, Chip } from '@/components/ui';
import { formatDecimal, groupRows, type InsightDay } from '@/lib/insights';
import { roundLevel } from '@/lib/mood/dayMood';
import { moodColors, spacing } from '@/lib/theme';

import { ActivityLine } from './ActivityLine';
import { InsightCard } from './InsightCard';
import type { ActivityNames, GroupActivities } from './names';

interface Props {
  days: InsightDay[];
  groups: GroupActivities[];
  names: ActivityNames;
}

/** One group at a time (sleep, weather) as a compact table: activity, mean mood, days. */
export function GroupCard({ days, groups, names }: Props) {
  const { t } = useTranslation();
  const used = useMemo(() => groups.filter((group) => days.some((day) => group.activityIds.some((id) => day.activities.has(id)))), [days, groups]);
  const [picked, setPicked] = useState<number | null>(null);
  const group = used.find((candidate) => candidate.id === picked) ?? used[0];
  const rows = useMemo(() => (group ? groupRows(days, group.activityIds) : []), [days, group]);
  const detail = (mean: number | null, count: number) =>
    mean === null ? t('insights.groups.few', { count }) : t('insights.groups.row', { mean: formatDecimal(mean), count });

  return (
    <InsightCard
      title={t('insights.groups.title')}
      empty={group ? null : t('insights.frequency.empty')}
      controls={
        used.length > 1 ? (
          <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={t('insights.groups.pick')}>
            {used.map((candidate) => (
              <Chip key={candidate.id} label={candidate.name} selected={candidate.id === group?.id} onPress={() => setPicked(candidate.id)} />
            ))}
          </View>
        ) : null
      }
    >
      {rows.map((row) => {
        const swatch = (last: boolean) =>
          row.mean === null ? null : <View style={[styles.swatch, last && styles.alignChevron, { backgroundColor: moodColors[roundLevel(row.mean)].strong }]} />;
        return row.activityId === null ? (
          <View key="none" style={styles.none} accessible accessibilityLabel={`${t('insights.groups.none')}: ${detail(row.mean, row.days)}`}>
            <View style={styles.text}>
              <AppText variant="label">{t('insights.groups.none')}</AppText>
              <AppText variant="caption" muted>
                {detail(row.mean, row.days)}
              </AppText>
            </View>
            {swatch(true)}
          </View>
        ) : (
          <ActivityLine
            key={row.activityId}
            activityId={row.activityId}
            icon={names.icon(row.activityId)}
            title={names.label(row.activityId)}
            detail={detail(row.mean, row.days)}
            trailing={swatch(false)}
          />
        );
      })}
    </InsightCard>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  none: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 44, paddingLeft: 44 },
  text: { flex: 1, gap: 2 },
  swatch: { width: 12, height: 12, borderRadius: 6 },
  // Where the chevron of the activity rows sits, so the swatches line up.
  alignChevron: { marginRight: 28 },
});
