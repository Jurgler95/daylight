import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { InsightCard } from '@/components/insights/InsightCard';
import { AppText, PressableScale } from '@/components/ui';
import type { MoodLevel } from '@/db/schema';
import { formatShortWithYear, type DateString } from '@/lib/dates';
import { haptics } from '@/lib/haptics';
import { formatMetric } from '@/lib/health/format';
import { formatDecimal, type HealthRecord } from '@/lib/insights';
import { roundLevel } from '@/lib/mood/dayMood';
import { TOUCH_TARGET, moodColors, radius, spacing, useTheme } from '@/lib/theme';

import { METRIC_ICONS } from './metrics';

interface Props {
  records: HealthRecord[];
  moodLabel: (level: MoodLevel) => string;
  onOpen: (date: DateString) => void;
}

/** The highest and lowest day of each metric in the range, with that day's mood; a row opens the day. */
export function HealthRecordsCard({ records, moodLabel, onOpen }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <InsightCard title={t('insights.healthStats.records.title')} empty={records.length === 0 ? t('insights.healthStats.empty') : null}>
      {records.map((record) => {
        const level = record.mood === null ? null : roundLevel(record.mood);
        const mood =
          record.mood === null || level === null
            ? t('insights.healthStats.records.noEntry')
            : t('insights.healthStats.records.mood', { mood: moodLabel(level), mean: formatDecimal(record.mood) });
        const title = t(`insights.healthStats.records.${record.key}`);
        const value = formatMetric(record.metric, record.value);
        const date = formatShortWithYear(record.date);
        return (
          <PressableScale
            key={record.key}
            pressedScale={0.98}
            onPress={() => {
              haptics.tap();
              onOpen(record.date);
            }}
            accessibilityRole="button"
            accessibilityLabel={`${title}: ${value}, ${date}, ${mood}`}
            accessibilityHint={t('insights.pixels.a11yHint')}
            style={styles.row}
          >
            <View style={[styles.icon, { backgroundColor: level ? moodColors[level].soft : colors.surfaceMuted }]}>
              <MaterialCommunityIcons name={METRIC_ICONS[record.metric]} size={18} color={level ? moodColors[level].strong : colors.text} />
            </View>
            <View style={styles.text}>
              <AppText variant="label">{title}</AppText>
              <AppText variant="caption" muted>
                {`${date}, ${mood}`}
              </AppText>
            </View>
            <AppText variant="label">{value}</AppText>
          </PressableScale>
        );
      })}
    </InsightCard>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: TOUCH_TARGET, paddingVertical: spacing.xs },
  icon: { width: 32, height: 32, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
});
