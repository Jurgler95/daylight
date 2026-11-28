import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText, Card } from '@/components/ui';
import { INSIGHT_MINIMUMS, type InsightReadiness } from '@/lib/insights/readiness';
import { radius, spacing, useTheme } from '@/lib/theme';

/**
 * In place of the cards while the diary is younger than `INSIGHT_MINIMUMS.diaryDays` days: how many
 * days are still missing, with a thin bar like the experiment's on "Heute", and what will come.
 */
export function ReadinessCard({ readiness }: { readiness: InsightReadiness }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const total = INSIGHT_MINIMUMS.diaryDays;
  const share = readiness.diaryDays / total;
  const progress = t('insights.ready.progress', { count: total, days: readiness.diaryDays });

  return (
    <Card tone="accent">
      <View style={styles.row}>
        <View style={[styles.icon, { backgroundColor: colors.surface }]}>
          <Ionicons name="analytics-outline" size={22} color={colors.accent} />
        </View>
        <AppText variant="headline" accessibilityRole="header" style={styles.flex}>
          {t('insights.ready.missing', { count: readiness.missing })}
        </AppText>
      </View>
      <View accessible accessibilityRole="progressbar" accessibilityLabel={progress} accessibilityValue={{ min: 0, max: total, now: readiness.diaryDays }}>
        <View style={[styles.track, { backgroundColor: colors.surface }]}>
          <View style={[styles.fill, { backgroundColor: colors.accent, width: `${Math.round(share * 100)}%` }]} />
        </View>
        <AppText variant="caption" muted style={styles.caption}>
          {progress}
        </AppText>
      </View>
      <AppText muted>{t('insights.ready.body')}</AppText>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  track: { height: 8, borderRadius: radius.sm, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.sm },
  caption: { marginTop: spacing.xs },
});
