import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { MoodBadge } from '@/components/mood/MoodBadge';
import { Photo } from '@/components/photo/Photo';
import { AppText, Card, PressableScale } from '@/components/ui';
import { getDb } from '@/db';
import { listEntriesOnDates } from '@/db/repositories/entries';
import { photosForEntries } from '@/db/repositories/photos';
import { levelMood, type Catalog } from '@/lib/catalog/catalog';
import { formatShortWithYear, type DateString } from '@/lib/dates';
import { haptics } from '@/lib/haptics';
import { upper } from '@/lib/i18n/language';
import type { IconName } from '@/lib/icons';
import { useQuery } from '@/lib/store/dataVersion';
import { lookbackDays, summariseDay } from '@/lib/today/lookback';
import { TOUCH_TARGET, radius, spacing, useTheme } from '@/lib/theme';

interface Props {
  date: DateString;
  catalog: Catalog;
  onOpenDay: (day: DateString) => void;
}

/**
 * The same day a week, a month, six months and a year ago, with mood, the start of the note and
 * the day's photos. A day with several entries is one line: its mood as the calendar shows it (the
 * mean of its entries), the most recent note, the photos of all entries and how many entries it has. Tapping a day opens it on "Heute", a photo opens itself full screen. Hidden
 * while none of the four days has an entry.
 */
export function LookbackCard({ date, catalog, onOpenDay }: Props) {
  const { t } = useTranslation();
  const { colors, mood: moodColors } = useTheme();
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
        const summary = summariseDay(rows.filter((row) => row.date === day.date));
        const mood = summary ? ((summary.moodId !== null ? catalog.moodById.get(summary.moodId) : undefined) ?? levelMood(catalog, summary.level)) : undefined;
        const dayPhotos = summary ? summary.entryIds.flatMap((id) => photos.get(id) ?? []) : [];
        const when = t(`lookback.${day.key}`);
        const note = summary?.note ?? '';
        const several = summary && summary.count > 1 ? t('calendar.entries', { count: summary.count }) : '';
        const spoken = [when, formatShortWithYear(day.date), summary ? mood?.label : t('lookback.none'), several, note].filter(Boolean).join('. ');
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
            {summary ? (
              <MoodBadge level={summary.level} icon={(mood?.icon ?? 'emoticon-neutral-outline') as IconName} size={40} />
            ) : (
              <View style={[styles.empty, { borderColor: colors.border }]} />
            )}
            <View style={styles.text}>
              <AppText variant="caption" muted>
                {[upper(when), formatShortWithYear(day.date), several].filter(Boolean).join(' · ')}
              </AppText>
              {summary ? (
                <AppText variant="label" color={moodColors[summary.level].strong}>
                  {mood?.label ?? ''}
                </AppText>
              ) : (
                <AppText variant="label" muted>
                  {t('lookback.none')}
                </AppText>
              )}
              {note ? <AppText numberOfLines={2}>{note}</AppText> : null}
              {dayPhotos.length > 0 ? (
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
