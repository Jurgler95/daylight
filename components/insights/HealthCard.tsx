import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import type { MoodLevel } from '@/db/schema';
import { formatDecimal, type HealthBand, type HealthMood } from '@/lib/insights';
import { moodColors, radius, spacing, useTheme } from '@/lib/theme';

import { InsightCard } from './InsightCard';

interface Props {
  mood: HealthMood;
}

/**
 * Mean mood by last night's sleep, by steps, with or without exercise and by resting pulse. The bar runs from 1 to 5
 * in the color of the rounded mean; bands with too few days show only their count.
 */
export function HealthCard({ mood }: Props) {
  const { t } = useTranslation();
  const sections = [
    { key: 'sleep', bands: mood.sleep },
    { key: 'steps', bands: mood.steps },
    { key: 'exercise', bands: mood.exercise },
    { key: 'restingHr', bands: mood.restingHr },
  ].filter((section) => section.bands.length > 0);

  return (
    <InsightCard title={t('insights.health.title')} empty={sections.length === 0 ? t('insights.health.empty') : null}>
      {sections.map((section) => (
        <View key={section.key} style={styles.section}>
          <AppText variant="label" muted>
            {t(`insights.health.${section.key}`)}
          </AppText>
          {section.bands.map((band) => (
            <BandRow key={band.key} band={band} bounds={mood.hrBounds} />
          ))}
        </View>
      ))}
      <AppText variant="caption" muted>
        {t('insights.health.hint', { count: mood.pairedDays })}
      </AppText>
    </InsightCard>
  );
}

function BandRow({ band, bounds }: { band: HealthBand; bounds: HealthMood['hrBounds'] }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const label = t(`insights.health.bands.${band.key}`, { low: bounds?.[0], high: bounds?.[1] });
  const level = band.mean === null ? null : (Math.min(5, Math.max(1, Math.round(band.mean))) as MoodLevel);
  const spoken =
    band.mean === null
      ? t('insights.health.a11yFew', { band: label, count: band.days })
      : t('insights.health.a11y', { band: label, mean: formatDecimal(band.mean, 2), count: band.days });
  return (
    <View style={styles.row} accessible accessibilityLabel={spoken}>
      <AppText variant="label" style={styles.name}>
        {label}
      </AppText>
      <View style={[styles.track, { backgroundColor: colors.surfaceMuted }]}>
        {band.mean !== null && level !== null ? (
          <View style={[styles.bar, { width: `${((band.mean - 1) / 4) * 100}%`, backgroundColor: moodColors[level].strong }]} />
        ) : null}
      </View>
      <AppText variant="label" style={styles.value}>
        {band.mean === null ? '' : formatDecimal(band.mean, 2)}
      </AppText>
      <AppText variant="caption" muted style={styles.count}>
        {band.days}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 28 },
  name: { width: 104 },
  track: { flex: 1, height: 12, borderRadius: radius.pill, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: radius.pill },
  value: { width: 40, textAlign: 'right' },
  count: { width: 28, textAlign: 'right' },
});
