import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { formatDecimal, formatSigned, orderWeekdays, type WeekdayProfile } from '@/lib/insights';
import { spacing, useTheme } from '@/lib/theme';

import { InsightCard } from './InsightCard';

interface Props {
  profile: WeekdayProfile;
  /** Short names, Sunday first. */
  names: string[];
  firstDay: number;
}

/** Smallest half-width of the scale, so a week of tiny differences does not look dramatic. */
const MIN_SCALE = 0.5;

/**
 * Mean per weekday with its count, and a bar that grows left or right from the overall mean:
 * the differences between weekdays are a few tenths, which bars from 1 to 5 would hide.
 */
export function WeekdayCard({ profile, names, firstDay }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const stats = orderWeekdays(profile.weekdays, firstDay);
  const scale = Math.max(MIN_SCALE, ...stats.map((s) => Math.abs(s.difference ?? 0)));
  return (
    <InsightCard title={t('insights.weekdays.title')} empty={profile.overall === null ? t('insights.emptyRange') : null}>
      {stats.map((stat) => {
        const name = names[stat.weekday] ?? '';
        const diff = stat.difference ?? 0;
        const fill = Math.abs(diff) / scale / 2;
        const label =
          stat.mean === null
            ? t('insights.weekdays.none', { day: name })
            : t('insights.weekdays.a11y', { day: name, mean: formatDecimal(stat.mean, 2), count: stat.days, diff: formatSigned(diff, 2) });
        return (
          <View key={stat.weekday} style={styles.row} accessible accessibilityLabel={label}>
            <AppText variant="label" style={styles.name}>
              {name}
            </AppText>
            <View style={[styles.track, { backgroundColor: colors.surfaceMuted }]}>
              <View style={[styles.center, { backgroundColor: colors.border }]} />
              {stat.mean !== null ? (
                <View
                  style={[
                    styles.bar,
                    { backgroundColor: colors.accent, width: `${fill * 100}%` },
                    diff >= 0 ? { left: '50%' } : { right: '50%' },
                  ]}
                />
              ) : null}
            </View>
            <AppText variant="label" style={styles.value}>
              {stat.mean === null ? '' : formatDecimal(stat.mean, 2)}
            </AppText>
            <AppText variant="caption" muted style={styles.count}>
              {stat.days}
            </AppText>
          </View>
        );
      })}
      {profile.overall !== null ? (
        <AppText variant="caption" muted>
          {t('insights.weekdays.overall', { mean: formatDecimal(profile.overall, 2) })}
        </AppText>
      ) : null}
    </InsightCard>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 28 },
  name: { width: 28 },
  track: { flex: 1, height: 12, borderRadius: 6, overflow: 'hidden' },
  center: { position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1 },
  bar: { position: 'absolute', top: 2, bottom: 2, borderRadius: 4 },
  value: { width: 40, textAlign: 'right' },
  count: { width: 28, textAlign: 'right' },
});
