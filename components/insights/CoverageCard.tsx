import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { formatPercent, type Coverage } from '@/lib/insights';
import { spacing, useTheme } from '@/lib/theme';

import { InsightCard } from './InsightCard';

/** Entries, days with an entry, coverage and the usual time, with a small histogram over the hours. */
export function CoverageCard({ coverage }: { coverage: Coverage | null }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  if (!coverage) return <InsightCard title={t('insights.coverage.title')} empty={t('insights.emptyRange')} />;
  const peak = Math.max(1, ...coverage.hours);
  const busiest = coverage.hours.indexOf(Math.max(...coverage.hours));
  const facts: [string, string][] = [
    [t('insights.coverage.entries'), String(coverage.entries)],
    [t('insights.coverage.days'), `${coverage.days} / ${coverage.spanDays}`],
    [t('insights.coverage.share'), formatPercent(coverage.share)],
    [t('insights.coverage.time'), coverage.typicalTime],
  ];
  return (
    <InsightCard title={t('insights.coverage.title')}>
      {facts.map(([label, value]) => (
        <View key={label} style={styles.row} accessible accessibilityLabel={`${label}: ${value}`}>
          <AppText muted>{label}</AppText>
          <AppText variant="label">{value}</AppText>
        </View>
      ))}
      <View accessible accessibilityRole="image" accessibilityLabel={t('insights.coverage.a11yHours', { from: busiest, to: busiest + 1 })} style={styles.hours}>
        {coverage.hours.map((count, hour) => (
          <View key={hour} style={styles.hour}>
            <View style={[styles.bar, { height: `${(count / peak) * 100}%`, backgroundColor: count ? colors.accent : colors.surfaceMuted }]} />
          </View>
        ))}
      </View>
      <View style={styles.axis} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {['0', '6', '12', '18', '24'].map((label) => (
          <AppText key={label} variant="caption" muted>
            {label}
          </AppText>
        ))}
      </View>
    </InsightCard>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', minHeight: 28 },
  hours: { flexDirection: 'row', alignItems: 'flex-end', height: 48, gap: 2, marginTop: spacing.sm },
  hour: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  bar: { borderRadius: 2, minHeight: 2 },
  axis: { flexDirection: 'row', justifyContent: 'space-between' },
});
