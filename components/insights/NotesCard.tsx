import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText, PressableScale } from '@/components/ui';
import type { MoodLevel } from '@/db/schema';
import { formatLong, type DateString } from '@/lib/dates';
import { upper } from '@/lib/i18n/language';
import { formatDecimal, formatPercent, type NoteStats } from '@/lib/insights';
import { radius, spacing, TOUCH_TARGET, useTheme } from '@/lib/theme';

import { InsightCard } from './InsightCard';

interface Props {
  notes: NoteStats;
  moodLabel: (level: MoodLevel) => string;
  onOpen: (date: DateString) => void;
}

/**
 * How much is written: days with a note, words per note, the mood with and without one, how often
 * each mood gets a note, and the day with the longest one.
 */
export function NotesCard({ notes, moodLabel, onOpen }: Props) {
  const { t } = useTranslation();
  const { colors, mood: moodColors } = useTheme();
  if (notes.days === 0) return <InsightCard title={t('insights.notes.title')} empty={t('insights.notes.empty')} />;

  const facts: [string, string][] = [
    [t('insights.notes.days'), t('insights.notes.daysValue', { days: notes.days, total: notes.totalDays, share: formatPercent(notes.share) })],
    [t('insights.notes.meanWords'), formatDecimal(notes.meanWords ?? 0, 0)],
    [t('insights.notes.words'), String(notes.words)],
  ];
  if (notes.withMean !== null && notes.withoutMean !== null) {
    facts.push([t('insights.notes.moodWith'), formatDecimal(notes.withMean)], [t('insights.notes.moodWithout'), formatDecimal(notes.withoutMean)]);
  }
  const levels = notes.byLevel.filter((row) => row.days > 0);
  const longest = notes.longest;

  return (
    <InsightCard title={t('insights.notes.title')}>
      {facts.map(([label, value]) => (
        <View key={label} style={styles.row} accessible accessibilityLabel={`${label}: ${value}`}>
          <AppText muted>{label}</AppText>
          <AppText variant="label">{value}</AppText>
        </View>
      ))}

      <AppText variant="caption" muted style={styles.heading}>
        {upper(t('insights.notes.byLevel'))}
      </AppText>
      {levels.map((row) => (
        <View
          key={row.level}
          style={styles.level}
          accessible
          accessibilityLabel={t('insights.notes.levelA11y', { mood: moodLabel(row.level), share: formatPercent(row.share), count: row.withNote, total: row.days })}
        >
          <AppText style={styles.levelLabel} numberOfLines={1}>
            {moodLabel(row.level)}
          </AppText>
          <View style={[styles.track, { backgroundColor: colors.surfaceMuted }]}>
            <View style={[styles.fill, { width: `${row.share * 100}%`, backgroundColor: moodColors[row.level].strong }]} />
          </View>
          <AppText variant="caption" muted style={styles.levelValue}>
            {formatPercent(row.share)}
          </AppText>
        </View>
      ))}

      {longest ? (
        <PressableScale
          pressedScale={0.98}
          onPress={() => onOpen(longest.date)}
          accessibilityRole="button"
          accessibilityLabel={t('insights.notes.longestA11y', { date: formatLong(longest.date), count: longest.words })}
          style={styles.longest}
        >
          <View style={styles.text}>
            <AppText variant="label">{t('insights.notes.longest')}</AppText>
            <AppText variant="caption" muted>
              {t('insights.notes.longestValue', { date: formatLong(longest.date), count: longest.words })}
            </AppText>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </PressableScale>
      ) : null}
    </InsightCard>
  );
}

/** The words written on the most days of the range, as pills with their day count. */
export function TopWordsCard({ notes }: { notes: NoteStats }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <InsightCard title={t('insights.notes.top')} empty={notes.top.length === 0 ? t('insights.words.empty') : null}>
      <View style={styles.pills}>
        {notes.top.map((stat) => (
          <View
            key={stat.word}
            style={[styles.pill, { backgroundColor: colors.surfaceMuted }]}
            accessible
            accessibilityLabel={t('insights.words.a11y', { word: stat.word, count: stat.days })}
          >
            <AppText variant="label">{stat.word}</AppText>
            <AppText variant="caption" muted>
              {stat.days}
            </AppText>
          </View>
        ))}
      </View>
    </InsightCard>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', minHeight: 28, gap: spacing.md },
  heading: { marginTop: spacing.sm },
  level: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 28 },
  levelLabel: { width: 96 },
  track: { flex: 1, height: 8, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill },
  levelValue: { width: 40, textAlign: 'right' },
  longest: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: TOUCH_TARGET, marginTop: spacing.sm },
  text: { flex: 1, gap: 2 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  pill: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
});
