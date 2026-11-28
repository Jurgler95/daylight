import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText, Button } from '@/components/ui';
import type { MoodLevel } from '@/db/schema';
import { formatMonthYear } from '@/lib/dates';
import { formatDecimal, USUAL_MIN_DAYS, type UsualMonth, type UsualRange } from '@/lib/insights';
import { radius, spacing, useTheme } from '@/lib/theme';

import { InsightCard } from './InsightCard';

interface Props {
  months: UsualMonth[];
  /** The usual range at the end of the range picked; null while the diary is too short for one. */
  usual: UsualRange | null;
  moodLabel: (level: MoodLevel) => string;
  /** Too little data yet: one line saying what the card still needs, in place of the months. */
  notYet?: string | null;
}

/** Months before "Alle zeigen". */
const SHOWN = 6;

/**
 * One row per month, newest first: its mean as a number and its days below and above the usual
 * range as a bar. Someone who picks the same mood on most days gets months with nearly the same
 * mean; the days outside their own usual range are what tells them apart.
 */
export function MonthCard({ months, usual, moodLabel, notYet = null }: Props) {
  const { t } = useTranslation();
  const { colors, mood: moodColors } = useTheme();
  const [all, setAll] = useState(false);
  const newestFirst = [...months].reverse();
  const range = usual ? (usual.lo === usual.hi ? moodLabel(usual.lo) : t('insights.months.usualSpan', { from: moodLabel(usual.lo), to: moodLabel(usual.hi) })) : null;

  return (
    <InsightCard title={t('insights.months.title')} empty={months.length === 0 ? t('insights.months.empty') : notYet}>
      {range ? <AppText variant="label">{t('insights.months.usual', { range })}</AppText> : null}
      <AppText variant="caption" muted>
        {range ? t('insights.months.usualHint') : t('insights.months.usualFew', { days: USUAL_MIN_DAYS })}
      </AppText>
      {(all ? newestFirst : newestFirst.slice(0, SHOWN)).map((month) => {
        const name = formatMonthYear(month.month);
        const mean = t('insights.months.mean', { value: formatDecimal(month.mean) });
        const counts = month.usual
          ? month.usual.below + month.usual.above === 0
            ? t('insights.months.allUsual')
            : t('insights.months.counts', { above: month.usual.above, below: month.usual.below })
          : null;
        return (
          <View key={month.month} style={styles.month} accessible accessibilityLabel={[name, mean, counts].filter(Boolean).join(', ')}>
            <View style={styles.head}>
              <AppText variant="label" style={styles.name}>
                {name}
              </AppText>
              <AppText variant="label">{mean}</AppText>
            </View>
            {month.usual ? (
              <View style={[styles.bar, { backgroundColor: colors.surfaceMuted }]}>
                {month.usual.below > 0 ? <View style={{ flex: month.usual.below, backgroundColor: moodColors[2].strong }} /> : null}
                {month.usual.within > 0 ? <View style={{ flex: month.usual.within, backgroundColor: colors.border }} /> : null}
                {month.usual.above > 0 ? <View style={{ flex: month.usual.above, backgroundColor: moodColors[5].strong }} /> : null}
              </View>
            ) : null}
            {counts ? (
              <AppText variant="caption" muted>
                {counts}
              </AppText>
            ) : null}
          </View>
        );
      })}
      {months.length > SHOWN ? <Button variant="ghost" label={t(all ? 'insights.effects.less' : 'insights.effects.more')} onPress={() => setAll(!all)} /> : null}
    </InsightCard>
  );
}

const styles = StyleSheet.create({
  month: { gap: spacing.xs, paddingVertical: spacing.xs },
  head: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.md },
  name: { flex: 1 },
  bar: { flexDirection: 'row', height: 10, borderRadius: radius.pill, overflow: 'hidden' },
});
