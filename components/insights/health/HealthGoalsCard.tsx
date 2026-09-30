import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { InsightCard } from '@/components/insights/InsightCard';
import { AppText } from '@/components/ui';
import { formatRange } from '@/lib/dates';
import { formatDuration } from '@/lib/health/format';
import { formatPercent, type GoalStats, type HealthStats, type Streak } from '@/lib/insights';
import { spacing } from '@/lib/theme';

/** How often sleep and steps reached their mark and training happened, with the longest and the current run. */
export function HealthGoalsCard({ stats }: { stats: HealthStats }) {
  const { t } = useTranslation();
  const sections = (['sleep', 'steps', 'exercise'] as const).flatMap((key) => {
    const goal = stats.goals[key];
    return goal ? [{ key, goal }] : [];
  });

  const run = (label: string, streak: Streak | null) => (
    <View style={styles.run}>
      <AppText variant="caption" muted style={styles.runLabel}>
        {label}
      </AppText>
      <AppText variant="caption">
        {streak
          ? `${t('insights.days', { count: streak.days })}${streak.days > 1 ? `, ${formatRange(streak.start, streak.end)}` : ''}`
          : t('insights.streaks.none')}
      </AppText>
    </View>
  );

  const section = (key: 'sleep' | 'steps' | 'exercise', goal: GoalStats & { minutesPerWeek?: number }) => (
    <View key={key} style={styles.section}>
      <View style={styles.head} accessible>
        <AppText variant="label" style={styles.title}>
          {t(`insights.healthStats.goals.${key}`)}
        </AppText>
        <AppText variant="headline">{formatPercent(goal.hit / goal.days)}</AppText>
      </View>
      <AppText variant="caption" muted>
        {t('insights.healthStats.goals.share', { hit: goal.hit, count: goal.days })}
        {goal.minutesPerWeek !== undefined ? `. ${t('insights.healthStats.goals.perWeek', { value: formatDuration(goal.minutesPerWeek) })}` : ''}
      </AppText>
      {run(t('insights.healthStats.goals.longest'), goal.longest)}
      {run(t('insights.healthStats.goals.current'), goal.current)}
    </View>
  );

  return (
    <InsightCard title={t('insights.healthStats.goals.title')} empty={sections.length === 0 ? t('insights.healthStats.empty') : null}>
      {sections.map(({ key, goal }) => section(key, goal))}
    </InsightCard>
  );
}

const styles = StyleSheet.create({
  section: { gap: 2 },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  title: { flex: 1 },
  run: { flexDirection: 'row', gap: spacing.sm },
  runLabel: { width: 96 },
});
