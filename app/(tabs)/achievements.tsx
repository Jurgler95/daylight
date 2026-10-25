import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { AchievementCard } from '@/components/achievements/AchievementCard';
import { AchievementsHero } from '@/components/achievements/AchievementsHero';
import { STAR_COLOR } from '@/components/achievements/StarRow';
import { AppText, Screen } from '@/components/ui';
import { byNextStar, nextInReach, TIER_COUNT, totalStars, type Achievement, type AchievementGroup, type AchievementKey } from '@/lib/achievements';
import { useAchievements } from '@/lib/achievements/useAchievements';
import { useToday } from '@/lib/dates/useToday';
import { formatCount } from '@/lib/insights';
import { radius, spacing, useTheme } from '@/lib/theme';
import { useSettingsStore } from '@/lib/store/settingsStore';

const GROUPS: readonly AchievementGroup[] = ['streaks', 'volume'];
const GROUP_ICON = { streaks: 'fire', volume: 'treasure-chest' } as const;
/** How long a card reached through `focus` stays marked. */
const FOCUS_MS = 1500;

/**
 * Stars for keeping the diary, first the runs, then the totals, each sorted by the next star in
 * reach. Nothing here looks at a mood.
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
  // How far along all achievements are on average, measured like the bar on each card.
  const progress = achievements.length > 0 ? achievements.reduce((sum, achievement) => sum + achievement.progress, 0) / achievements.length : 0;
  const needsHealth = (achievement: Achievement) => !!achievement.health && !healthEnabled && achievement.best === 0;
  const upNext = nextInReach(achievements.filter((achievement) => !needsHealth(achievement)));

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

  const focusCard = (key: AchievementKey) => {
    target.current = key;
    setMarked(key);
    scrollToTarget();
  };

  useEffect(() => {
    const key = achievements.find((achievement) => achievement.key === focus)?.key;
    if (!key) return;
    // Taken back at once, so coming back to the tab later does not scroll again.
    router.setParams({ focus: undefined });
    focusCard(key);
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
      <AchievementsHero
        stars={stars}
        complete={complete}
        total={achievements.length}
        progress={progress}
        upNext={upNext}
        onUpNext={(achievement) => focusCard(achievement.key)}
      />
      {GROUPS.map((group) => {
        // Closest next star first; what needs Health Connect first can't be reached and goes last.
        const members = achievements
          .filter((achievement) => achievement.group === group)
          .sort((a, b) => Number(needsHealth(a)) - Number(needsHealth(b)) || byNextStar(a, b));
        const offset = achievements.findIndex((achievement) => achievement.group === group);
        const groupStars = { stars: formatCount(totalStars(members)), max: formatCount(members.length * TIER_COUNT) };
        return (
          <View
            key={group}
            style={styles.group}
            onLayout={(event) => {
              groupTops.current.set(group, event.nativeEvent.layout.y);
              scrollToTarget();
            }}
          >
            <View style={styles.groupHead}>
              <View style={[styles.groupIcon, { backgroundColor: colors.accentSoft }]}>
                <MaterialCommunityIcons name={GROUP_ICON[group]} size={16} color={colors.accent} />
              </View>
              <AppText variant="label" accessibilityRole="header" style={styles.groupTitle}>
                {t(`achievements.groups.${group}`).toUpperCase()}
              </AppText>
              <View style={[styles.groupStars, { backgroundColor: colors.surface, borderColor: colors.border }]} accessible accessibilityLabel={t('achievements.stars', groupStars)}>
                <MaterialCommunityIcons name="star" size={14} color={STAR_COLOR} />
                <AppText variant="caption">{t('achievements.starsShort', groupStars)}</AppText>
              </View>
            </View>
            {members.map((achievement, index) => (
              <AchievementCard
                key={achievement.key}
                achievement={achievement}
                needsHealth={needsHealth(achievement)}
                highlight={marked === achievement.key}
                index={offset + index}
                onLayout={(event) => {
                  const { y, height: cardHeight } = event.nativeEvent.layout;
                  cardBoxes.current.set(achievement.key, { group, y, height: cardHeight });
                  scrollToTarget();
                }}
              />
            ))}
          </View>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.md },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  groupIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  groupTitle: { flex: 1 },
  groupStars: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.pill, borderWidth: 1 },
});
