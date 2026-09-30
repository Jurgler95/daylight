import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { addDaysToDateString, formatRange } from '@/lib/dates';
import { formatDecimal, type Swings, type WeekSwing } from '@/lib/insights';
import { spacing } from '@/lib/theme';

import { InsightCard } from './InsightCard';

/** Median spread within a week, then the calmest and the most unsettled weeks by name. */
export function SwingsCard({ swings }: { swings: Swings }) {
  const { t } = useTranslation();
  const list = (title: string, weeks: WeekSwing[]) =>
    weeks.length ? (
      <View style={styles.list}>
        <AppText variant="caption" muted>
          {title.toUpperCase()}
        </AppText>
        {weeks.map((week) => {
          const range = formatRange(week.start, addDaysToDateString(week.start, 6));
          const detail = t('insights.swings.row', { mean: formatDecimal(week.mean), spread: formatDecimal(week.spread, 2) });
          return (
            <View key={week.start} style={styles.row} accessible accessibilityLabel={`${range}: ${detail}`}>
              <AppText variant="label" style={styles.range}>
                {range}
              </AppText>
              <AppText variant="caption" muted>
                {detail}
              </AppText>
            </View>
          );
        })}
      </View>
    ) : null;

  return (
    <InsightCard title={t('insights.swings.title')} empty={swings.typical === null ? t('insights.swings.empty') : null}>
      <AppText>{t('insights.swings.typical', { value: formatDecimal(swings.typical ?? 0, 2) })}</AppText>
      {list(t('insights.swings.calm'), swings.calmest)}
      {list(t('insights.swings.rough'), swings.roughest)}
    </InsightCard>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.sm, minHeight: 28 },
  range: { flexShrink: 1 },
});
