import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { formatRange } from '@/lib/dates';
import type { Streak, Streaks } from '@/lib/insights';
import { spacing } from '@/lib/theme';

import { InsightCard } from './InsightCard';

/** The longest run from "Gut" upwards and the one still going. Facts, nothing to keep up. */
export function StreakCard({ streaks, goodLabel }: { streaks: Streaks; goodLabel: string }) {
  const { t } = useTranslation();
  const row = (title: string, streak: Streak | null) => {
    const value = streak ? t('insights.days', { count: streak.days }) : t('insights.streaks.none');
    const range = streak ? formatRange(streak.start, streak.end) : '';
    return (
      <View style={styles.row} accessible accessibilityLabel={`${title}: ${value}${range ? `, ${range}` : ''}`}>
        <View style={styles.text}>
          <AppText variant="label">{title}</AppText>
          {range ? (
            <AppText variant="caption" muted>
              {range}
            </AppText>
          ) : null}
        </View>
        <AppText variant="headline">{value}</AppText>
      </View>
    );
  };
  return (
    <InsightCard title={t('insights.streaks.title')}>
      {row(t('insights.streaks.longest', { mood: goodLabel }), streaks.longest)}
      {row(t('insights.streaks.current'), streaks.current)}
    </InsightCard>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 36 },
  text: { flex: 1, gap: 2 },
});
