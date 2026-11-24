import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText, PressableScale } from '@/components/ui';
import { formatMetric } from '@/lib/health/format';
import { formatDecimal, type TrendItem, type TrendSubject } from '@/lib/insights';
import { formatScaleValue } from '@/lib/scales/format';
import { spacing, useTheme } from '@/lib/theme';

import { InsightCard } from './InsightCard';

interface Props {
  trends: TrendItem[];
  /** Opens the tab of a scale or health value; mood has no tab of its own beyond this one. */
  onOpen: (subject: TrendSubject) => void;
}

/**
 * Only what currently stands out: a run of weekly means in one direction, the last four weeks
 * against the quarter before, or both. Hidden while nothing does, so it never fills the page with
 * "no trend".
 */
export function TrendsCard({ trends, onOpen }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  if (trends.length === 0) return null;

  const name = (subject: TrendSubject) => {
    if (subject.kind === 'mood') return t('insights.trends.mood');
    if (subject.kind === 'scale') return subject.scale.name;
    return t(`insights.healthStats.metric.${subject.metric}`);
  };
  const format = (subject: TrendSubject, value: number) => {
    if (subject.kind === 'mood') return formatDecimal(value, 1);
    if (subject.kind === 'scale') return formatScaleValue(subject.scale, value);
    return formatMetric(subject.metric, value);
  };

  return (
    <InsightCard title={t('insights.trends.title')}>
      <AppText variant="caption" muted>
        {t('insights.trends.hint')}
      </AppText>
      {trends.map((item) => {
        const { subject, run, shift, turningPoint } = item;
        const direction = run?.direction ?? shift!.direction;
        const headline = run
          ? t(`insights.trends.run.${run.direction}`, { name: name(subject), count: run.weeks })
          : t(`insights.trends.shift.${shift!.direction}`, { name: name(subject) });
        const lines = [
          run ? t('insights.trends.runDetail', { from: format(subject, run.from), to: format(subject, run.to) }) : null,
          shift ? t('insights.trends.shiftDetail', { recent: format(subject, shift.recent), before: format(subject, shift.before) }) : null,
          turningPoint ? t('insights.trends.turning', { title: turningPoint.title }) : null,
        ].filter((line): line is string => line !== null);
        const key = subject.kind === 'scale' ? `scale-${subject.scale.id}` : subject.kind === 'health' ? subject.metric : 'mood';
        const content = (
          <>
            <MaterialCommunityIcons name={direction === 'up' ? 'trending-up' : 'trending-down'} size={20} color={colors.accent} />
            <View style={styles.text}>
              <AppText variant="label">{headline}</AppText>
              {lines.map((line) => (
                <AppText key={line} variant="caption" muted>
                  {line}
                </AppText>
              ))}
            </View>
          </>
        );
        const label = [headline, ...lines].join('. ');
        return subject.kind === 'mood' ? (
          <View key={key} style={styles.row} accessible accessibilityLabel={label}>
            {content}
          </View>
        ) : (
          <PressableScale key={key} pressedScale={0.98} onPress={() => onOpen(subject)} accessibilityRole="button" accessibilityLabel={label} style={styles.row}>
            {content}
          </PressableScale>
        );
      })}
    </InsightCard>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingVertical: spacing.xs },
  text: { flex: 1, gap: 2 },
});
