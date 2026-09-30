import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { MoodBadge } from '@/components/mood/MoodBadge';
import { AppText, PressableScale } from '@/components/ui';
import type { MoodLevel } from '@/db/schema';
import { haptics } from '@/lib/haptics';
import { formatPercent, type LevelShare } from '@/lib/insights';
import type { IconName } from '@/lib/icons';
import { TOUCH_TARGET, moodColors, radius, spacing, useTheme } from '@/lib/theme';

import { InsightCard } from './InsightCard';

interface Props {
  rows: LevelShare[];
  moodFor: (level: MoodLevel) => { label: string; icon: IconName };
}

/** Share per mood as one stacked bar, then a row per mood with the window before; a row opens the mood's page. */
export function DistributionCard({ rows, moodFor }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const shown = rows.filter((row) => row.days > 0 || (row.previousShare ?? 0) > 0);
  return (
    <InsightCard title={t('insights.distribution.title')}>
      <View style={[styles.bar, { backgroundColor: colors.surfaceMuted }]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {rows.map((row) => (row.share > 0 ? <View key={row.level} style={{ flex: row.share, backgroundColor: moodColors[row.level].strong }} /> : null))}
      </View>
      {shown.map((row) => {
        const mood = moodFor(row.level);
        const before = row.previousShare === null ? null : formatPercent(row.previousShare);
        const label = before
          ? t('insights.distribution.a11yBefore', { mood: mood.label, share: formatPercent(row.share), count: row.days, before })
          : t('insights.distribution.a11y', { mood: mood.label, share: formatPercent(row.share), count: row.days });
        return (
          <PressableScale
            key={row.level}
            pressedScale={0.98}
            onPress={() => {
              haptics.tap();
              router.push({ pathname: '/mood/[level]', params: { level: String(row.level) } });
            }}
            accessibilityRole="button"
            accessibilityLabel={label}
            style={styles.row}
          >
            <MoodBadge level={row.level} icon={mood.icon} size={32} />
            <View style={styles.text}>
              <AppText variant="label">{mood.label}</AppText>
              <AppText variant="caption" muted>
                {t('insights.days', { count: row.days })}
              </AppText>
            </View>
            <View style={styles.numbers}>
              <AppText variant="label">{formatPercent(row.share)}</AppText>
              {before ? (
                <AppText variant="caption" muted>
                  {t('insights.distribution.before', { share: before })}
                </AppText>
              ) : null}
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </PressableScale>
        );
      })}
    </InsightCard>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', height: 14, borderRadius: radius.pill, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: TOUCH_TARGET },
  text: { flex: 1, gap: 2 },
  numbers: { alignItems: 'flex-end', gap: 2 },
});
