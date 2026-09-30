import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { MoodBadge } from '@/components/mood/MoodBadge';
import { Photo } from '@/components/photo/Photo';
import { AppText } from '@/components/ui';
import type { HealthDay } from '@/db/schema';
import type { Catalog } from '@/lib/catalog/catalog';
import { formatLong, formatWeekdayShort, type DateString } from '@/lib/dates';
import { formatDurationShort, formatSteps } from '@/lib/health/format';
import type { IconName } from '@/lib/icons';
import type { SearchHit } from '@/lib/search/search';
import { TOUCH_TARGET, moodColors, radius, spacing, useTheme } from '@/lib/theme';

/** Icons beyond this collapse into "+n", so a busy day stays on one line. */
const MAX_ICONS = 10;

interface Props {
  hit: SearchHit;
  catalog: Catalog;
  /** The day's values from Health Connect, shown as one short line. */
  health?: HealthDay | null;
  healthLabels?: HealthLabels;
  /** Opens the entry's day. */
  onPress: (date: DateString) => void;
}

/** Screen reader words for the health line, passed in so the row stays free of i18n. */
export interface HealthLabels {
  sleep: string;
  steps: string;
  exercise: string;
}

function healthParts(health: HealthDay): { icon: IconName; text: string; kind: keyof HealthLabels }[] {
  const parts: { icon: IconName; text: string; kind: keyof HealthLabels }[] = [];
  if (health.sleep_minutes !== null) parts.push({ icon: 'power-sleep', text: formatDurationShort(health.sleep_minutes), kind: 'sleep' });
  if (health.steps !== null) parts.push({ icon: 'shoe-print', text: formatSteps(health.steps), kind: 'steps' });
  if (health.exercise_minutes !== null && health.exercise_minutes > 0) parts.push({ icon: 'run', text: `${Math.round(health.exercise_minutes)} min`, kind: 'exercise' });
  return parts;
}

/** One entry in the timeline: day, mood, activity icons and a note excerpt. Matched activities are highlighted. */
export const EntryRow = memo(function EntryRow({ hit, catalog, health, healthLabels, onPress }: Props) {
  const { colors } = useTheme();
  const { entry } = hit;
  const mood = catalog.moodById.get(entry.mood_id);
  const activities = entry.activity_ids
    .map((id) => catalog.activityById.get(id))
    .filter((activity) => activity !== undefined)
    .sort((a, b) => catalog.activities.indexOf(a) - catalog.activities.indexOf(b));
  const shown = activities.slice(0, MAX_ICONS);
  const parts = health ? healthParts(health) : [];
  const healthSpoken = parts.map((part) => `${healthLabels?.[part.kind] ?? ''} ${part.text}`.trim()).join(', ');
  const spoken = [formatLong(entry.date), entry.time, mood?.label, activities.map((a) => a.name).join(', '), healthSpoken, hit.snippet]
    .filter(Boolean)
    .join('. ');

  return (
    <Pressable
      onPress={() => onPress(entry.date)}
      accessibilityRole="button"
      accessibilityLabel={spoken}
      style={({ pressed }) => [styles.row, { borderBottomColor: colors.border, opacity: pressed ? 0.6 : 1 }]}
    >
      <View style={styles.day}>
        <AppText variant="caption" muted>
          {formatWeekdayShort(entry.date)}
        </AppText>
        <AppText variant="headline">{Number(entry.date.slice(8, 10))}</AppText>
      </View>
      <MoodBadge level={entry.level} icon={(mood?.icon ?? 'emoticon-neutral-outline') as IconName} size={40} />
      <View style={styles.body}>
        <View style={styles.title}>
          <AppText variant="label" color={moodColors[entry.level].strong}>
            {mood?.label ?? ''}
          </AppText>
          <AppText variant="caption" muted>
            {entry.time}
          </AppText>
        </View>
        {shown.length > 0 ? (
          <View style={styles.icons}>
            {shown.map((activity) => (
              <MaterialCommunityIcons
                key={activity.id}
                name={activity.icon as IconName}
                size={17}
                color={hit.matchedActivityIds.includes(activity.id) ? colors.accent : colors.textMuted}
              />
            ))}
            {activities.length > shown.length ? (
              <AppText variant="caption" muted>
                +{activities.length - shown.length}
              </AppText>
            ) : null}
          </View>
        ) : null}
        {parts.length > 0 ? (
          <View style={styles.health}>
            {parts.map((part) => (
              <View key={part.kind} style={styles.healthPart}>
                <MaterialCommunityIcons name={part.icon} size={14} color={colors.textMuted} />
                <AppText variant="caption" muted>
                  {part.text}
                </AppText>
              </View>
            ))}
          </View>
        ) : null}
        {entry.note_title ? (
          <AppText variant="label" numberOfLines={1}>
            {entry.note_title}
          </AppText>
        ) : null}
        {hit.snippet ? (
          <AppText muted numberOfLines={3}>
            {hit.snippet}
          </AppText>
        ) : null}
      </View>
      {entry.photos?.[0] ? <Photo name={entry.photos[0]} style={[styles.thumb, { backgroundColor: colors.surfaceMuted }]} /> : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    minHeight: TOUCH_TARGET,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  day: { width: 32, alignItems: 'center' },
  thumb: { width: 56, height: 56, borderRadius: radius.sm },
  body: { flex: 1, gap: spacing.xs },
  title: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  icons: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  health: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: spacing.md, rowGap: 2 },
  healthPart: { flexDirection: 'row', alignItems: 'center', gap: 3 },
});
