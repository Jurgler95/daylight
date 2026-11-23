import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { formatSigned, linkStrength } from '@/lib/insights';
import { spacing, useTheme } from '@/lib/theme';

interface Props {
  title: string;
  r: number;
  pairs: number;
  /** The link in words for `r` of a noticeable strength, e.g. "Mehr Schlaf, bessere Stimmung (mittel)". */
  sentence: (direction: 'up' | 'down', strength: string) => string;
}

/**
 * One correlation: a bar grows left or right from the middle, the sentence says it in words, since
 * few people read r. Shared by every card on "Zusammenhänge".
 */
export function LinkRow({ title, r, pairs, sentence }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const level = linkStrength(r);
  const text = level === 'none' ? t('insights.healthStats.links.none') : sentence(r > 0 ? 'up' : 'down', t(`insights.healthStats.links.strength.${level}`));
  const detail = t('insights.healthStats.links.detail', { r: formatSigned(r, 2), count: pairs });
  return (
    <View style={styles.item} accessible accessibilityLabel={`${title}. ${text}. ${detail}`}>
      <AppText variant="label">{title}</AppText>
      <View style={[styles.track, { backgroundColor: colors.surfaceMuted }]}>
        <View style={[styles.center, { backgroundColor: colors.border }]} />
        <View
          style={[
            styles.bar,
            { backgroundColor: level === 'none' ? colors.textMuted : colors.accent, width: `${Math.max(0.01, Math.abs(r) / 2) * 100}%` },
            r >= 0 ? { left: '50%' } : { right: '50%' },
          ]}
        />
      </View>
      <AppText variant="caption">{text}</AppText>
      <AppText variant="caption" muted>
        {detail}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  item: { gap: spacing.xs, paddingVertical: spacing.xs },
  track: { height: 10, borderRadius: 5, overflow: 'hidden' },
  center: { position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1 },
  bar: { position: 'absolute', top: 2, bottom: 2, borderRadius: 3 },
});
