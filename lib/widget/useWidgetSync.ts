import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Image } from 'react-native';

import { getDb } from '@/db';
import { lastMoodOnDate } from '@/db/repositories/entries';
import { useDayMarkers } from '@/lib/calendar/useDayMarkers';
import { useCatalog } from '@/lib/catalog/useCatalog';
import { addDaysToDateString, formatWeekdayShort, type DateString } from '@/lib/dates';
import { useToday } from '@/lib/dates/useToday';
import { useQuery } from '@/lib/store/dataVersion';
import { useSettingsStore } from '@/lib/store/settingsStore';
import { readStreak } from '@/lib/streak/celebrate';
import Widget from '@/modules/daylight-widget';

import { buildWidgetState } from './state';

/** A Sunday, to name the weekdays from. */
const SUNDAY = '2026-01-04' as DateString;

/** Short weekday names, Sunday first. Takes the language only so a change of it computes them anew. */
function weekdayNames(_language: string): string[] {
  return Array.from({ length: 7 }, (_, i) => formatWeekdayShort(addDaysToDateString(SUNDAY, i)));
}

function iconFont(): string | null {
  try {
    return Image.resolveAssetSource(MaterialCommunityIcons.font['material-community'] as number)?.uri ?? null;
  } catch {
    return null;
  }
}

/**
 * Hands the home screen widgets (`modules/daylight-widget`) what they draw, after every change: the
 * moods, the mood of today's last entry, the recent days, the streak and their texts in the app's language. A tap on a
 * mood there opens `/entry/new?mood=<id>`, a new entry every time. Mounted once in the root layout.
 */
export function useWidgetSync(): void {
  const { t, i18n } = useTranslation();
  const catalog = useCatalog();
  const today = useToday();
  const markers = useDayMarkers();
  const weekStart = useSettingsStore((s) => s.settings?.first_day_of_week) ?? 1;
  const locked = useSettingsStore((s) => s.settings?.app_lock_enabled) ?? false;
  // The mood of today's last entry; the history widget keeps the day's mean (`markers`).
  const moodId = useQuery(() => lastMoodOnDate(getDb(), today), [today]);
  const streak = useQuery(() => readStreak(today), [today]);
  const weekdays = useMemo(() => weekdayNames(i18n.language), [i18n.language]);
  const title = t('today.ask');
  const streakLabel = t('streak.celebration.inARow', { count: streak.days });
  const streakLabelZero = t('streak.celebration.inARow', { count: 0 });
  const newEntry = t('entry.newTitle');

  useEffect(() => {
    if (!Widget) return;
    const state = buildWidgetState({
      title,
      font: iconFont(),
      moods: catalog.moods,
      glyphs: MaterialCommunityIcons.getRawGlyphMap(),
      date: today,
      moodId,
      days: markers,
      weekStart,
      weekdays,
      streak,
      streakLabel,
      streakLabelZero,
      newEntry,
      locked,
    });
    try {
      Widget.update(JSON.stringify(state));
    } catch {
      // The widgets are an extra; the app must never trip over them.
    }
  }, [catalog.moods, title, today, moodId, markers, weekStart, weekdays, streak, streakLabel, streakLabelZero, newEntry, locked]);
}
