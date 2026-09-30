import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { EntryCard } from '@/components/entry/EntryCard';
import { HealthDayCard } from '@/components/health/HealthDayCard';
import { MoodPicker } from '@/components/mood/MoodPicker';
import { OutlookDayCard } from '@/components/outlook/OutlookDayCard';
import { PlanCards } from '@/components/outlook/PlanCards';
import { BackupCard } from '@/components/today/BackupCard';
import { DayStrip, type DayStripHandle } from '@/components/today/DayStrip';
import { LookbackCard } from '@/components/today/LookbackCard';
import { LowMoodCard } from '@/components/today/LowMoodCard';
import { AppText, Button, Card, CardMotion, EmptyState, Screen } from '@/components/ui';
import { getDb } from '@/db';
import { listEntryDetails } from '@/db/repositories/entries';
import { useCatalog } from '@/lib/catalog/useCatalog';
import { useDayLabel } from '@/lib/calendar/useDayLabel';
import { useCalendarMarkers } from '@/lib/calendar/useDayMarkers';
import { daysBetween, formatLong, type DateString } from '@/lib/dates';
import { useToday } from '@/lib/dates/useToday';
import { useHealthDay } from '@/lib/health/useHealthDays';
import { useOutlook } from '@/lib/outlook/useOutlook';
import { useQuery } from '@/lib/store/dataVersion';
import { useSelectedDay } from '@/lib/store/selectedDay';
import { useLowMoodNote } from '@/lib/support/useLowMoodNote';
import { spacing, useTheme } from '@/lib/theme';

export default function TodayScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const now = useToday();
  const [date, setDate] = useSelectedDay(now);
  const strip = useRef<DayStripHandle>(null);
  const catalog = useCatalog();
  const markers = useCalendarMarkers(now);
  const { enabled: outlookEnabled, outlook } = useOutlook(now);
  const lowMood = useLowMoodNote(now);
  const dayLabel = useDayLabel(now);
  const entries = useQuery(() => listEntryDetails(getDb(), date, date), [date]);
  const health = useHealthDay(date);

  const offset = daysBetween(now, date);
  const isFuture = offset > 0;
  const outlookDay = outlookEnabled && outlook?.status === 'ready' ? outlook.days.find((day) => day.date === date) : undefined;
  const title =
    offset === 0
      ? t('tabs.today')
      : offset === -1
        ? t('today.yesterday')
        : offset === 1
          ? t('today.tomorrow')
          : offset > 0
            ? t('today.relFuture', { count: offset })
            : t('today.relPast', { count: -offset });

  // A day picked in the calendar (or today coming back at midnight) is scrolled into view;
  // a day tapped in the strip already is, and jumping under the finger would be jarring. The first
  // render is placed by the strip's initial index.
  const tapped = useRef<DateString | null>(date);
  useEffect(() => {
    if (tapped.current !== date) strip.current?.scrollToDate(date);
    tapped.current = null;
  }, [date]);

  const newEntry = (mood?: number) =>
    router.push({ pathname: '/entry/new', params: mood === undefined ? { date } : { date, mood: String(mood) } });

  const pinned = (
    <>
      <View style={styles.strip}>
        <DayStrip
          ref={strip}
          today={now}
          selected={date}
          markers={markers}
          label={(day) => dayLabel(day, markers.get(day))}
          onSelect={(day) => {
            tapped.current = day;
            setDate(day);
          }}
        />
      </View>
      <View style={styles.header}>
        {/* Keyed on the day, so the heading rolls in fresh whenever another day is picked. */}
        <Animated.View key={date} entering={FadeInDown.duration(140)} style={styles.headerText}>
          <AppText variant="caption" color={colors.accent} style={styles.eyebrow}>
            {formatLong(date).toUpperCase()}
          </AppText>
          <AppText variant="title" accessibilityRole="header">
            {title}
          </AppText>
        </Animated.View>
        {offset !== 0 ? <Button label={t('calendar.today')} variant="secondary" onPress={() => setDate(now)} /> : null}
      </View>
    </>
  );

  // One entry per day: the picker is there until the day has one, after that the entry is edited.
  const picker = (
    <Card tone="accent">
      <AppText variant="headline">{t('today.ask')}</AppText>
      <MoodPicker moods={catalog.moods} onPick={newEntry} size={52} />
    </Card>
  );

  return (
    <Screen sticky={pinned}>
      <CardMotion value>
        {isFuture ? (
          <>
            {outlookDay ? <OutlookDayCard day={outlookDay} catalog={catalog} /> : <EmptyState icon="sparkles-outline" label={t('today.future')} />}
            <PlanCards date={date} catalog={catalog} />
          </>
        ) : (
          <>
            {entries.length === 0 ? picker : null}
            {entries.map((entry) => (
              <EntryCard
                key={entry.id}
                entry={entry}
                catalog={catalog}
                scaleLabel={(name, value, max) => t('entry.scaleLine', { name, value, max })}
                editLabel={t('today.editHint')}
                photoLabel={t('photo.open')}
                onEdit={() => router.push({ pathname: '/entry/[id]', params: { id: String(entry.id) } })}
              />
            ))}
            {health ? <HealthDayCard day={health} /> : null}
            {offset === 0 ? <LookbackCard date={date} catalog={catalog} onOpenDay={setDate} /> : null}
            {offset === 0 && lowMood.show ? <LowMoodCard onDismiss={lowMood.dismiss} /> : null}
            {offset === 0 ? <BackupCard /> : null}
          </>
        )}
      </CardMotion>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Full bleed, so days scroll off both edges of the screen instead of the card gutter.
  strip: { marginHorizontal: -spacing.lg },
  header: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md, marginBottom: spacing.sm },
  headerText: { flex: 1, gap: spacing.xs },
  eyebrow: { letterSpacing: 1 },
});
