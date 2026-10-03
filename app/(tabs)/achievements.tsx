import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AchievementCard } from '@/components/achievements/AchievementCard';
import { STAR_COLOR } from '@/components/achievements/StarRow';
import { AppText, Card, Screen } from '@/components/ui';
import { MAX_STARS, totalStars, type AchievementGroup } from '@/lib/achievements';
import { useAchievements } from '@/lib/achievements/useAchievements';
import { useToday } from '@/lib/dates/useToday';
import { formatCount } from '@/lib/insights';
import { radius, spacing, useTheme } from '@/lib/theme';
import { useSettingsStore } from '@/lib/store/settingsStore';

const GROUPS: readonly AchievementGroup[] = ['streaks', 'volume'];

/** Stars for keeping the diary, first the runs, then the totals. Nothing here looks at a mood. */
export default function AchievementsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const today = useToday();
  const achievements = useAchievements(today);
  const healthEnabled = useSettingsStore((s) => s.settings?.health_enabled ?? false);
  const stars = totalStars(achievements);
  const complete = achievements.filter((achievement) => achievement.next === null).length;
  const summary = t('achievements.stars', { stars: formatCount(stars), max: formatCount(MAX_STARS) });
  // How far along all achievements are on average, measured like the bar on each card.
  const progress = achievements.length > 0 ? achievements.reduce((sum, achievement) => sum + achievement.progress, 0) / achievements.length : 0;
  const percent = Math.floor(progress * 100);

  return (
    <Screen title={t('achievements.title')}>
      <Card tone="accent">
        <View style={styles.summary} accessible accessibilityLabel={`${summary}. ${t('achievements.complete', { count: complete, total: achievements.length })}. ${t('achievements.overallLabel', { value: percent })}`}>
          <MaterialCommunityIcons name="trophy" size={44} color={STAR_COLOR} />
          <View style={styles.summaryText}>
            <AppText variant="title">{t('achievements.starsShort', { stars: formatCount(stars), max: formatCount(MAX_STARS) })}</AppText>
            <AppText variant="caption" muted>
              {t('achievements.complete', { count: complete, total: achievements.length })}
            </AppText>
          </View>
        </View>
        <View style={styles.progress} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <View style={[styles.track, { backgroundColor: colors.surface }]}>
            <View style={[styles.fill, { width: `${progress * 100}%`, backgroundColor: STAR_COLOR }]} />
          </View>
          <AppText variant="label" style={styles.percent}>
            {t('achievements.percent', { value: percent })}
          </AppText>
        </View>
        <AppText variant="caption" muted>
          {t('achievements.intro')}
        </AppText>
      </Card>
      {GROUPS.map((group) => (
        <View key={group} style={styles.group}>
          <AppText variant="caption" muted accessibilityRole="header">
            {t(`achievements.groups.${group}`).toUpperCase()}
          </AppText>
          {achievements
            .filter((achievement) => achievement.group === group)
            .map((achievement) => (
              <AchievementCard
                key={achievement.key}
                achievement={achievement}
                needsHealth={!!achievement.health && !healthEnabled && achievement.best === 0}
              />
            ))}
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  summaryText: { flex: 1, gap: spacing.xs },
  progress: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  percent: { minWidth: 44, textAlign: 'right' },
  track: { flex: 1, height: 10, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill },
  group: { gap: spacing.md },
});
