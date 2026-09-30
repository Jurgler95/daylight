import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { MonthList, type MonthListHandle } from '@/components/calendar/MonthList';
import { AppText, Button, Screen } from '@/components/ui';
import { getDb } from '@/db';
import { MOOD_LEVELS } from '@/db/schema';
import { firstEntryDate } from '@/db/repositories/entries';
import { isAhead, type CalendarMarker } from '@/lib/calendar/dayLabel';
import { firstOfMonth, monthsBetween, shiftMonth, type WeekStart } from '@/lib/calendar/monthGrid';
import { useDayLabel } from '@/lib/calendar/useDayLabel';
import { useCalendarMarkers } from '@/lib/calendar/useDayMarkers';
import { levelMood } from '@/lib/catalog/catalog';
import { useCatalog } from '@/lib/catalog/useCatalog';
import type { DateString } from '@/lib/dates';
import { useToday } from '@/lib/dates/useToday';
import { useQuery } from '@/lib/store/dataVersion';
import { useSelectedDayStore } from '@/lib/store/selectedDay';
import { useSettingsStore } from '@/lib/store/settingsStore';
import { moodColors, radius, spacing, useTheme } from '@/lib/theme';

/** Enough to plan the coming weeks; the outlook itself reaches seven days. */
const MONTHS_AHEAD = 3;
/** Even an empty database gets something to scroll through. */
const MIN_MONTHS_BACK = 3;

export default function CalendarScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const now = useToday();
  const thisMonth = firstOfMonth(now);
  const weekStartsOn = (useSettingsStore((s) => s.settings?.first_day_of_week) ?? 1) as WeekStart;
  const list = useRef<MonthListHandle>(null);
  const catalog = useCatalog();
  const markers = useCalendarMarkers(now);
  const hasRing = useMemo(() => [...markers.values()].some((marker) => isAhead(marker) && marker.outlook !== null), [markers]);
  const dayLabel = useDayLabel(now);
  const pick = useSelectedDayStore((s) => s.pick);

  // The past reaches back to the first entry, the future a few months ahead.
  const from = useQuery(() => {
    const first = firstEntryDate(getDb());
    const floor = shiftMonth(thisMonth, -MIN_MONTHS_BACK);
    return first && firstOfMonth(first) < floor ? firstOfMonth(first) : floor;
  }, [thisMonth]);
  const months = useMemo(() => monthsBetween(from, shiftMonth(thisMonth, MONTHS_AHEAD)), [from, thisMonth]);

  const label = (date: DateString, marker: CalendarMarker | undefined) => dayLabel(date, marker);
  // A day opens on "Heute", which shows all its entries and can add one.
  const open = (date: DateString) => {
    pick(date === now ? null : date);
    router.navigate('/');
  };

  const pinned = (
    <View style={styles.head}>
      <AppText variant="title" accessibilityRole="header" style={styles.title}>
        {t('tabs.calendar')}
      </AppText>
      <Button label={t('calendar.today')} variant="secondary" onPress={() => list.current?.scrollToMonth(thisMonth)} />
    </View>
  );

  // Pinned below the list, so it stays readable while scrolling (Zyklus 1.0.3).
  const legend = (
    <View style={[styles.legend, { borderTopColor: colors.border }]}>
      {[...MOOD_LEVELS].reverse().map((level) => {
        const mood = levelMood(catalog, level);
        return (
          <View key={level} style={styles.legendItem}>
            <MaterialCommunityIcons name={mood.icon} size={16} color={moodColors[level].strong} />
            <AppText variant="caption" muted>
              {mood.label}
            </AppText>
          </View>
        );
      })}
      <View style={styles.legendItem}>
        <View style={[styles.legendDot, { backgroundColor: colors.textMuted }]} />
        <AppText variant="caption" muted>
          {t('calendar.legendSeveral')}
        </AppText>
      </View>
      {hasRing ? (
        <View style={styles.legendItem}>
          <View style={[styles.legendRing, { borderColor: colors.textMuted }]} />
          <AppText variant="caption" muted>
            {t('calendar.legendOutlook')}
          </AppText>
        </View>
      ) : null}
    </View>
  );

  return (
    <Screen scroll={false} sticky={pinned}>
      {/* An opaque white panel, so the days stand out clearly instead of blending into the backdrop. */}
      <View style={[styles.list, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <MonthList
          ref={list}
          months={months}
          current={thisMonth}
          weekStartsOn={weekStartsOn}
          today={now}
          markers={markers}
          label={label}
          onSelectDay={open}
          contentPaddingBottom={spacing.lg}
        />
      </View>
      {legend}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  title: { flex: 1 },
  list: { flex: 1, borderRadius: radius.lg, borderWidth: 1.5, paddingHorizontal: spacing.sm, overflow: 'hidden' },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  legendDot: { width: 5, height: 5, borderRadius: 3 },
  legendRing: { width: 12, height: 12, borderRadius: 6, borderWidth: 2 },
});
