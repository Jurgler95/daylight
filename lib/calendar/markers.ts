import type { MoodLevel } from '@/db/schema';
import type { DateString } from '@/lib/dates';
import type { IconName } from '@/lib/icons';
import { dayMoods } from '@/lib/mood/dayMood';

import { isAhead, type AheadMarker, type CalendarMarker, type DayMarker } from './dayLabel';

export interface MarkerEntry {
  date: DateString;
  time: string;
  level: number;
  mood_id: number;
}

/**
 * One marker per day with entries. The icon is the one of the latest entry whose mood sits on the
 * day's rounded level; a mixed day without such an entry ("Schlecht" and "Super" make "Ok") takes
 * the icon the level stands for.
 */
export function buildDayMarkers(
  entries: readonly MarkerEntry[],
  moodIcon: (moodId: number) => IconName | undefined,
  levelIcon: (level: MoodLevel) => IconName,
  turningDates: ReadonlySet<string> = new Set(),
): Map<DateString, DayMarker> {
  const latestByDayAndLevel = new Map<string, MarkerEntry>();
  for (const entry of entries) {
    const key = `${entry.date}|${entry.level}`;
    const previous = latestByDayAndLevel.get(key);
    if (!previous || previous.time <= entry.time) latestByDayAndLevel.set(key, entry);
  }
  const markers = new Map<DateString, DayMarker>();
  for (const [date, day] of dayMoods(entries)) {
    const source = latestByDayAndLevel.get(`${date}|${day.level}`);
    const icon = (source && moodIcon(source.mood_id)) ?? levelIcon(day.level);
    markers.set(date, turningDates.has(date) ? { level: day.level, icon, count: day.count, turning: true } : { level: day.level, icon, count: day.count });
  }
  return markers;
}

/**
 * Markers for future days: the outlook's level where it has a range, and planned activities in the
 * order they were stored. Only days with at least one of the two get a marker.
 */
export function buildAheadMarkers(
  plans: ReadonlyMap<DateString, readonly number[]>,
  outlook: ReadonlyMap<DateString, { level: MoodLevel; icon: IconName }>,
  activity: (id: number) => { icon: IconName; name: string } | undefined,
): Map<DateString, AheadMarker> {
  const markers = new Map<DateString, AheadMarker>();
  for (const date of new Set([...plans.keys(), ...outlook.keys()])) {
    const planned = (plans.get(date) ?? []).flatMap((id) => {
      const found = activity(id);
      return found ? [found] : [];
    });
    const level = outlook.get(date) ?? null;
    if (level !== null || planned.length) markers.set(date, { outlook: level, planned });
  }
  return markers;
}

export function sameMarker(a: CalendarMarker, b: CalendarMarker): boolean {
  if (isAhead(a) || isAhead(b)) {
    if (!isAhead(a) || !isAhead(b)) return false;
    return a.outlook?.level === b.outlook?.level && a.outlook?.icon === b.outlook?.icon && a.planned.length === b.planned.length && a.planned.every((p, i) => p.icon === b.planned[i]!.icon && p.name === b.planned[i]!.name);
  }
  return a.level === b.level && a.icon === b.icon && a.count === b.count && !!a.turning === !!b.turning;
}
