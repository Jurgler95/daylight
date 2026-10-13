import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { AchievementCard } from '@/components/achievements/AchievementCard';
import { STAR_COLOR } from '@/components/achievements/StarRow';
import { AppText, Card, Screen } from '@/components/ui';
import { MAX_STARS, totalStars, type AchievementGroup, type AchievementKey } from '@/lib/achievements';
import { useAchievements } from '@/lib/achievements/useAchievements';
import { useToday } from '@/lib/dates/useToday';
import { formatCount } from '@/lib/insights';
import { radius, spacing, useTheme } from '@/lib/theme';
import { useSettingsStore } from '@/lib/store/settingsStore';

const GROUPS: readonly AchievementGroup[] = ['streaks', 'volume'];
/** How long a card reached through `focus` stays marked. */
const FOCUS_MS = 1500;

/**
 * Stars for keeping the diary, first the runs, then the totals. Nothing here looks at a mood.
 * `?focus=<key>` (from the star message or the streak chip) scrolls that card to the middle and
 * marks it for a moment.
 */
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

  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const { height } = useWindowDimensions();
  const scroll = useRef<ScrollView>(null);
  // Cards report their place inside their group, groups theirs inside the scroll content.
  const groupTops = useRef(new Map<AchievementGroup, number>());
  const cardBoxes = useRef(new Map<AchievementKey, { group: AchievementGroup; y: number; height: number }>());
  const target = useRef<AchievementKey | null>(null);
  const [marked, setMarked] = useState<AchievementKey | null>(null);

  const scrollToTarget = () => {
    const key = target.current;
    const box = key ? cardBoxes.current.get(key) : undefined;
    const groupTop = box ? groupTops.current.get(box.group) : undefined;
    if (!box || groupTop === undefined) return;
    target.current = null;
    scroll.current?.scrollTo({ y: Math.max(0, groupTop + box.y - (height - box.height) / 2), animated: true });
  };

  useEffect(() => {
    const key = achievements.find((achievement) => achievement.key === focus)?.key;
    if (!key) return;
    target.current = key;
    setMarked(key);
    // Taken back at once, so coming back to the tab later does not scroll again.
    router.setParams({ focus: undefined });
    scrollToTarget();
    // Only a new `focus` starts this; the layout callbacks finish a scroll that had to wait for them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);

  useEffect(() => {
    if (!marked) return;
    const timeout = setTimeout(() => setMarked(null), FOCUS_MS);
    return () => clearTimeout(timeout);
  }, [marked]);

  return (
    <Screen title={t('achievements.title')} scrollRef={scroll}>
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
        <View
          key={group}
          style={styles.group}
          onLayout={(event) => {
            groupTops.current.set(group, event.nativeEvent.layout.y);
            scrollToTarget();
          }}
        >
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
                highlight={marked === achievement.key}
                onLayout={(event) => {
                  const { y, height: cardHeight } = event.nativeEvent.layout;
                  cardBoxes.current.set(achievement.key, { group, y, height: cardHeight });
                  scrollToTarget();
                }}
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
