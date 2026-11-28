import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText, PressableScale } from '@/components/ui';
import { haptics } from '@/lib/haptics';
import { radius, spacing, useTheme } from '@/lib/theme';

/** Words as pills with their day count; tapping one opens the page of that word. */
export function WordPills({ words }: { words: readonly { word: string; days: number }[] }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <View style={styles.pills}>
      {words.map((stat) => (
        <PressableScale
          key={stat.word}
          pressedScale={0.95}
          onPress={() => {
            haptics.tap();
            router.push({ pathname: '/word/[word]', params: { word: stat.word } });
          }}
          accessibilityRole="button"
          accessibilityLabel={t('insights.words.a11y', { word: stat.word, count: stat.days })}
          accessibilityHint={t('insights.word.open')}
          style={[styles.pill, { backgroundColor: colors.surfaceMuted }]}
        >
          <AppText variant="label">{stat.word}</AppText>
          <AppText variant="caption" muted>
            {stat.days}
          </AppText>
        </PressableScale>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  // At least 36 high; the row gap keeps neighbours apart for a finger.
  pill: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, minHeight: 36 },
});
