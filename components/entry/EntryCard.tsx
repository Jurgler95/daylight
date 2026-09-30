import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { MoodBadge } from '@/components/mood/MoodBadge';
import { Photo } from '@/components/photo/Photo';
import { AppText, Card, PressableScale } from '@/components/ui';
import type { EntryDetails } from '@/db/repositories/entries';
import type { Catalog } from '@/lib/catalog/catalog';
import { haptics } from '@/lib/haptics';
import type { IconName } from '@/lib/icons';
import { moodColors, radius, spacing, useTheme } from '@/lib/theme';

interface Props {
  entry: EntryDetails;
  catalog: Catalog;
  /** "Energie 3 von 5". */
  scaleLabel: (name: string, value: number, max: number) => string;
  editLabel: string;
  /** Spoken on a photo, which opens it full screen. */
  photoLabel: string;
  onEdit: () => void;
}

/** One entry to read in full: mood and time, activities, scale values, note, photos. Tapping opens the editor, a photo opens itself. */
export function EntryCard({ entry, catalog, scaleLabel, editLabel, photoLabel, onEdit }: Props) {
  const { colors } = useTheme();
  const mood = catalog.moodById.get(entry.mood_id);
  const activities = entry.activity_ids
    .map((id) => catalog.activityById.get(id))
    .filter((activity) => activity !== undefined)
    // Display order (group, then order inside it), not the order they were ticked in.
    .sort((a, b) => catalog.activities.indexOf(a) - catalog.activities.indexOf(b));
  const scales = entry.scales
    .map((value) => ({ scale: catalog.scaleById.get(value.scale_id), value: value.value }))
    .filter((item) => item.scale !== undefined)
    .map((item) => scaleLabel(item.scale?.name ?? '', item.value, item.scale?.max ?? 0));
  const spoken = [mood?.label, entry.time, activities.map((a) => a.name).join(', '), scales.join(', '), entry.note_title, entry.note]
    .filter(Boolean)
    .join('. ');

  return (
    <PressableScale
      pressedScale={0.98}
      onPress={() => {
        haptics.tap();
        onEdit();
      }}
      accessibilityRole="button"
      accessibilityLabel={spoken}
      accessibilityHint={editLabel}
    >
      <Card>
        <View style={styles.head}>
          <MoodBadge level={entry.level} icon={(mood?.icon ?? 'emoticon-neutral-outline') as IconName} size={44} />
          <View style={styles.flex}>
            <AppText variant="headline" color={moodColors[entry.level].strong}>
              {mood?.label ?? ''}
            </AppText>
            <AppText variant="caption" muted>
              {entry.time}
            </AppText>
          </View>
        </View>
        {activities.length > 0 ? (
          <View style={styles.pills}>
            {activities.map((activity) => (
              <View key={activity.id} style={[styles.pill, { backgroundColor: colors.surfaceMuted }]}>
                <MaterialCommunityIcons name={activity.icon as IconName} size={16} color={colors.text} />
                <AppText variant="caption">{activity.name}</AppText>
              </View>
            ))}
          </View>
        ) : null}
        {scales.length > 0 ? (
          <AppText variant="caption" muted>
            {scales.join(' · ')}
          </AppText>
        ) : null}
        {entry.note_title ? <AppText variant="label">{entry.note_title}</AppText> : null}
        {entry.note ? <AppText>{entry.note}</AppText> : null}
        {entry.photos.map((name) => (
          <Pressable
            key={name}
            onPress={() => router.push({ pathname: '/photo/[name]', params: { name } })}
            accessibilityRole="imagebutton"
            accessibilityLabel={photoLabel}
          >
            <Photo name={name} style={[styles.photo, { backgroundColor: colors.surfaceMuted }]} />
          </Pressable>
        ))}
      </Card>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius.md },
  pill: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.pill },
});
