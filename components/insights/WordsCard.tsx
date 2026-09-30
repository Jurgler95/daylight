import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import type { NoteWords, WordStat } from '@/lib/insights';
import { radius, spacing, useTheme } from '@/lib/theme';

import { InsightCard } from './InsightCard';

/**
 * Words that lean towards good or less good days, as plain pills. Counted on the device from the
 * notes; nothing about them leaves it.
 */
export function WordsCard({ words, goodLabel }: { words: NoteWords; goodLabel: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const side = (title: string, list: WordStat[]) => (
    <View style={styles.side}>
      <AppText variant="caption" muted>
        {title.toUpperCase()}
      </AppText>
      {list.length ? (
        <View style={styles.pills}>
          {list.map((stat) => (
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
      ) : (
        <AppText muted>{t('insights.words.none')}</AppText>
      )}
    </View>
  );
  const empty = words.good.length + words.low.length === 0;
  return (
    <InsightCard title={t('insights.words.title')} empty={empty ? t('insights.words.empty') : null}>
      {side(t('insights.words.good', { mood: goodLabel }), words.good)}
      {side(t('insights.words.low'), words.low)}
    </InsightCard>
  );
}

const styles = StyleSheet.create({
  side: { gap: spacing.sm },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  pill: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
});
