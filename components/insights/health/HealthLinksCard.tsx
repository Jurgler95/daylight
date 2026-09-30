import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { InsightCard } from '@/components/insights/InsightCard';
import { AppText } from '@/components/ui';
import { formatSigned, MIN_LINK_PAIRS, type HealthLink } from '@/lib/insights';
import { spacing, useTheme } from '@/lib/theme';

/** How strong a correlation of this size reads. Below the first it is "hardly any". */
const STRENGTHS = [
  { below: 0.1, key: 'none' },
  { below: 0.3, key: 'weak' },
  { below: 0.5, key: 'medium' },
  { below: Infinity, key: 'strong' },
] as const;

function strength(r: number): (typeof STRENGTHS)[number]['key'] {
  return STRENGTHS.find((s) => Math.abs(r) < s.below)!.key;
}

/**
 * Correlation of each value with the mood, on the same day and one step later. A bar grows left
 * or right from the middle; the sentence says it in words, since few people read r.
 */
export function HealthLinksCard({ links }: { links: HealthLink[] }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const sorted = [...links].sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
  return (
    <InsightCard title={t('insights.healthStats.links.title')} empty={sorted.length === 0 ? t('insights.healthStats.links.empty', { count: MIN_LINK_PAIRS }) : null}>
      {sorted.map((link) => {
        const title = t(`insights.healthStats.links.pairing.${link.metric}.${link.pairing}`);
        const level = strength(link.r);
        const sentence =
          level === 'none'
            ? t('insights.healthStats.links.none')
            : t(`insights.healthStats.links.${link.pairing === 'nightAfter' ? 'nightAfter' : link.metric}.${link.r > 0 ? 'up' : 'down'}`, {
                strength: t(`insights.healthStats.links.strength.${level}`),
              });
        const detail = t('insights.healthStats.links.detail', { r: formatSigned(link.r, 2), count: link.pairs });
        return (
          <View key={`${link.metric}:${link.pairing}`} style={styles.item} accessible accessibilityLabel={`${title}. ${sentence}. ${detail}`}>
            <AppText variant="label">{title}</AppText>
            <View style={[styles.track, { backgroundColor: colors.surfaceMuted }]}>
              <View style={[styles.center, { backgroundColor: colors.border }]} />
              <View
                style={[
                  styles.bar,
                  { backgroundColor: level === 'none' ? colors.textMuted : colors.accent, width: `${Math.max(0.01, Math.abs(link.r) / 2) * 100}%` },
                  link.r >= 0 ? { left: '50%' } : { right: '50%' },
                ]}
              />
            </View>
            <AppText variant="caption">{sentence}</AppText>
            <AppText variant="caption" muted>
              {detail}
            </AppText>
          </View>
        );
      })}
      <AppText variant="caption" muted>
        {t('insights.healthStats.links.hint')}
      </AppText>
    </InsightCard>
  );
}

const styles = StyleSheet.create({
  item: { gap: spacing.xs, paddingVertical: spacing.xs },
  track: { height: 10, borderRadius: 5, overflow: 'hidden' },
  center: { position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1 },
  bar: { position: 'absolute', top: 2, bottom: 2, borderRadius: 3 },
});
