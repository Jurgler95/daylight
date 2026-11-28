import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { upper } from '@/lib/i18n/language';
import type { NoteWords, WordStat } from '@/lib/insights';
import { spacing } from '@/lib/theme';

import { InsightCard } from './InsightCard';
import { WordPills } from './WordPills';

/**
 * Words that lean towards good or less good days, as pills that open the word's page. Counted on the device from the
 * notes; nothing about them leaves it.
 */
export function WordsCard({ words, goodLabel }: { words: NoteWords; goodLabel: string }) {
  const { t } = useTranslation();
  const side = (title: string, list: WordStat[]) => (
    <View style={styles.side}>
      <AppText variant="caption" muted>
        {upper(title)}
      </AppText>
      {list.length ? (
        <WordPills words={list} />
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
});
