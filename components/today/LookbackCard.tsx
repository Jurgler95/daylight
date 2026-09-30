import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { MoodBadge } from '@/components/mood/MoodBadge';
import { Photo } from '@/components/photo/Photo';
import { AppText, Card, PressableScale } from '@/components/ui';
import { getDb } from '@/db';
import { listEntriesOnDates } from '@/db/repositories/entries';
import { photosForEntries } from '@/db/repositories/photos';
import type { MoodLevel } from '@/db/schema';
import type { Catalog } from '@/lib/catalog/catalog';
import { formatShortWithYear, type DateString } from '@/lib/dates';
import { haptics } from '@/lib/haptics';
import type { IconName } from '@/lib/icons';
import { useQuery } from '@/lib/store/dataVersion';
import { lookbackDays } from '@/lib/today/lookback';
import { TOUCH_TARGET, moodColors, radius, spacing, useTheme } from '@/lib/theme';

interface Props {
  date: DateString;
  catalog: Catalog;
  onOpenDay: (day: DateString) => void;
}

/**
 * The same day a week, a month, six months and a year ago, with mood, the start of the note and
 * the day's photos. Tapping a day opens it on "Heute", a photo opens itself full screen. Hidden
 * while none of the four days has an entry.
 */
export function LookbackCard({ date, catalog, onOpenDay }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const days = lookbackDays(date);
  const { rows, photos } = useQuery(() => {
    const db = getDb();
    const rows = listEntriesOnDates(db, days.map((day) => day.date));
    return { rows, photos: photosForEntries(db, rows.map((row) => row.id)) };
  }, [date]);
  if (rows.length === 0) return null;

  return (
    <Card>
      <AppText variant="headline" accessibilityRole="header">
        {t('lookback.title')}
      </AppText>
      {days.map((day) => {
        // One entry per day; a day imported with several shows its first.
        const entry = rows.find((row) => row.date === day.date);
        const mood = entry ? catalog.moodById.get(entry.mood_id) : undefined;
        const dayPhotos = entry ? photos.get(entry.id) : undefined;
        const when = t(`lookback.${day.key}`);
        const note = [entry?.note_title, entry?.note].filter((part) => part && part.trim() !== '').join(' ');
        const spoken = [when, formatShortWithYear(day.date), entry ? mood?.label : t('lookback.none'), note].filter(Boolean).join('. ');
        return (
          <PressableScale
            key={day.key}
            onPress={() => {
              haptics.tap();
              onOpenDay(day.date);
            }}
            accessibilityRole="button"
            accessibilityLabel={spoken}
            accessibilityHint={t('lookback.hint')}
            style={styles.row}
          >
            {entry ? (
              <MoodBadge level={entry.level as MoodLevel} icon={(mood?.icon ?? 'emoticon-neutral-outline') as IconName} size={40} />
            ) : (
              <View style={[styles.empty, { borderColor: colors.border }]} />
            )}
            <View style={styles.text}>
              <AppText variant="caption" muted>
                {`${when.toUpperCase()} · ${formatShortWithYear(day.date)}`}
              </AppText>
              {entry ? (
                <AppText variant="label" color={moodColors[entry.level as MoodLevel].strong}>
                  {mood?.label ?? ''}
                </AppText>
              ) : (
                <AppText variant="label" muted>
                  {t('lookback.none')}
                </AppText>
              )}
              {note ? <AppText numberOfLines={2}>{note}</AppText> : null}
              {dayPhotos ? (
                <View style={styles.photos}>
                  {dayPhotos.map((name) => (
                    <Pressable
                      key={name}
                      onPress={() => router.push({ pathname: '/photo/[name]', params: { name } })}
                      accessibilityRole="imagebutton"
                      accessibilityLabel={t('photo.open')}
                    >
                      <Photo name={name} style={[styles.photo, { backgroundColor: colors.surfaceMuted }]} />
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          </PressableScale>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, minHeight: TOUCH_TARGET, borderRadius: radius.sm },
  empty: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderStyle: 'dashed' },
  text: { flex: 1, gap: 2 },
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  photo: { width: 72, height: 72, borderRadius: radius.sm },
});
