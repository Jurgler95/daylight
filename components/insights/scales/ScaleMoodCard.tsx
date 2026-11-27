import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { InsightCard } from '@/components/insights/InsightCard';
import { AppText } from '@/components/ui';
import { formatDuration } from '@/lib/health/format';
import { upper } from '@/lib/i18n/language';
import { formatDecimal, formatSigned, linkStrength, MIN_BAND_DAYS, MIN_LINK_PAIRS, type ScaleBucket, type ScaleInsight } from '@/lib/insights';
import { roundLevel } from '@/lib/mood/dayMood';
import { radius, spacing, useTheme } from '@/lib/theme';

/**
 * The mood of the days at each value: does a 5 in energy go with better days than a 2? A bar per
 * value, in the colour of the mood it averages to, and underneath in words how closely scale and
 * mood move together, on the same day and the day after.
 */
export function ScaleMoodCard({ insight }: { insight: ScaleInsight }) {
  const { t } = useTranslation();
  const { colors, mood: moodColors } = useTheme();
  const { scale } = insight;
  const rows = insight.buckets.filter((bucket) => bucket.days > 0);
  const first = insight.buckets[0];
  const label = (bucket: ScaleBucket) => {
    if (scale.kind === 'number') {
      // Split at the quartiles, so "unter" the first cut, "ab" the last, ranges between. Without the
      // unit, the title names the scale and the row stays short.
      const value = (n: number) => formatDecimal(n, scale.decimals ?? 0);
      if (bucket.to === null) return bucket === first ? value(bucket.from) : t('insights.scales.bucket.over', { value: value(bucket.from) });
      if (bucket === first) return t('insights.scales.bucket.under', { value: value(bucket.to) });
      return t('insights.scales.bucket.between', { from: value(bucket.from), to: value(bucket.to) });
    }
    if (scale.kind !== 'duration') return String(bucket.from);
    if (bucket.to === null) return t('insights.scales.bucket.over', { value: formatDuration(bucket.from) });
    if (bucket.from === 0) return formatDuration(0);
    if (bucket.from === 1) return t('insights.scales.bucket.under', { value: formatDuration(bucket.to + 1) });
    return t('insights.scales.bucket.between', { from: formatDuration(bucket.from), to: formatDuration(bucket.to + 1) });
  };

  return (
    <InsightCard title={t('insights.scales.mood.title', { name: scale.name })}>
      {rows.map((bucket) => {
        const name = label(bucket);
        const days = t('insights.scales.mood.days', { count: bucket.days });
        const a11y =
          bucket.mood === null
            ? `${name}: ${days}, ${t('insights.healthStats.split.few')}`
            : t('insights.scales.mood.a11y', { value: name, mood: formatDecimal(bucket.mood), count: bucket.days });
        return (
          <View key={bucket.from} style={styles.row} accessible accessibilityLabel={a11y}>
            <AppText variant="label" style={[styles.name, scale.kind === 'number' && styles.wideName]} numberOfLines={1}>
              {name}
            </AppText>
            <View style={[styles.track, { backgroundColor: colors.surfaceMuted }]}>
              {bucket.mood !== null ? (
                <View style={[styles.bar, { width: `${Math.max(0.04, (bucket.mood - 1) / 4) * 100}%`, backgroundColor: moodColors[roundLevel(bucket.mood)].strong }]} />
              ) : null}
            </View>
            <AppText variant="label" style={styles.mood}>
              {bucket.mood === null ? '' : formatDecimal(bucket.mood)}
            </AppText>
            <AppText variant="caption" muted style={styles.days} numberOfLines={1}>
              {days}
            </AppText>
          </View>
        );
      })}
      <AppText variant="caption" muted>
        {t('insights.scales.mood.hint', { count: MIN_BAND_DAYS })}
      </AppText>
      {insight.links.length === 0 ? (
        <AppText variant="caption" muted>
          {t('insights.scales.links.few', { count: MIN_LINK_PAIRS })}
        </AppText>
      ) : (
        insight.links.map((link) => {
          const level = linkStrength(link.r);
          const sentence =
            level === 'none'
              ? t('insights.healthStats.links.none')
              : t(`insights.scales.links.${link.pairing}.${link.r > 0 ? 'up' : 'down'}`, { scale: scale.name, strength: t(`insights.healthStats.links.strength.${level}`) });
          const title = t(`insights.scales.links.${link.pairing}.title`);
          const detail = t('insights.healthStats.links.detail', { r: formatSigned(link.r, 2), count: link.pairs });
          return (
            <View key={link.pairing} style={styles.link} accessible accessibilityLabel={`${title}. ${sentence}. ${detail}`}>
              <AppText variant="caption" muted>
                {upper(title)}
              </AppText>
              <AppText>{sentence}</AppText>
              <AppText variant="caption" muted>
                {detail}
              </AppText>
            </View>
          );
        })
      )}
    </InsightCard>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 28 },
  name: { width: 84 },
  wideName: { width: 120 },
  track: { flex: 1, height: 12, borderRadius: radius.pill, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: radius.pill },
  mood: { width: 32, textAlign: 'right' },
  days: { width: 56, textAlign: 'right' },
  link: { gap: 2, paddingTop: spacing.xs },
});
