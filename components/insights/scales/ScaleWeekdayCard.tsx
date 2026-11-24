import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { InsightCard } from '@/components/insights/InsightCard';
import { AppText } from '@/components/ui';
import { orderWeekdays, type ScaleInsight } from '@/lib/insights';
import { formatScaleValue } from '@/lib/scales/format';
import { radius, spacing, useTheme } from '@/lib/theme';

interface Props {
  insight: ScaleInsight;
  /** Short names, Sunday first. */
  names: string[];
  firstDay: number;
}

/** Mean of the scale per weekday. Rating bars start at the bottom of the scale, so a 1 is an empty bar. */
export function ScaleWeekdayCard({ insight, names, firstDay }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { scale } = insight;
  const rows = orderWeekdays(insight.weekdays, firstDay);
  const lo = scale.kind === 'duration' ? 0 : scale.min;
  const hi = scale.kind === 'duration' ? Math.max(1, ...rows.flatMap((row) => (row.mean === null ? [] : [row.mean]))) : scale.max;
  return (
    <InsightCard title={t('insights.scales.weekdays', { name: scale.name })}>
      {rows.map((row) => {
        const name = names[row.weekday] ?? '';
        const value = row.mean === null ? '' : formatScaleValue(scale, row.mean);
        return (
          <View
            key={row.weekday}
            style={styles.row}
            accessible
            accessibilityLabel={row.mean === null ? t('insights.weekdays.none', { day: name }) : t('insights.healthStats.weekdays.a11y', { day: name, value, count: row.days })}
          >
            <AppText variant="label" style={styles.name}>
              {name}
            </AppText>
            <View style={[styles.track, { backgroundColor: colors.surfaceMuted }]}>
              {row.mean !== null ? <View style={[styles.bar, { width: `${Math.max(0.02, (row.mean - lo) / (hi - lo)) * 100}%`, backgroundColor: colors.accent }]} /> : null}
            </View>
            <AppText variant="label" style={styles.value} numberOfLines={1}>
              {value}
            </AppText>
          </View>
        );
      })}
    </InsightCard>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 28 },
  name: { width: 28 },
  track: { flex: 1, height: 12, borderRadius: radius.pill, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: radius.pill },
  value: { width: 92, textAlign: 'right' },
});
