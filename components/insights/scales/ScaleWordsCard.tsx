import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { InsightCard } from '@/components/insights/InsightCard';
import { WordPills } from '@/components/insights/WordPills';
import { AppText } from '@/components/ui';
import { upper } from '@/lib/i18n/language';
import type { ScaleFacts, ScaleWords, WordStat } from '@/lib/insights';
import { formatScaleValue } from '@/lib/scales/format';
import { spacing } from '@/lib/theme';

/** Words written more on days with a high value of the scale and more on days with a low one, split at the median. */
export function ScaleWordsCard({ scale, words }: { scale: ScaleFacts; words: ScaleWords }) {
  const { t } = useTranslation();
  const median = words.median;
  const side = (title: string, list: WordStat[]) => (
    <View style={styles.side}>
      <AppText variant="caption" muted>
        {upper(title)}
      </AppText>
      {list.length ? <WordPills words={list} /> : <AppText muted>{t('insights.words.none')}</AppText>}
    </View>
  );
  const empty = median === null || words.high.length + words.low.length === 0;
  return (
    <InsightCard title={t('insights.scales.words.title')} empty={empty ? t('insights.scales.words.empty') : null}>
      {median !== null ? (
        <>
          {side(t('insights.scales.words.high', { value: formatScaleValue(scale, median) }), words.high)}
          {side(t('insights.scales.words.low', { value: formatScaleValue(scale, median) }), words.low)}
        </>
      ) : null}
    </InsightCard>
  );
}

const styles = StyleSheet.create({
  side: { gap: spacing.sm },
});
