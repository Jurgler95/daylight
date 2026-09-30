import { useMemo } from 'react';

import { getDb } from '@/db';
import { listEntryMoods } from '@/db/repositories/entries';
import { activityLabel, levelMood } from '@/lib/catalog/catalog';
import { useCatalog } from '@/lib/catalog/useCatalog';
import type { IconName } from '@/lib/icons';
import type { MoodLevel } from '@/db/schema';
import type { DateString } from '@/lib/dates';
import { useFuturePlans, useOutlook } from '@/lib/outlook/useOutlook';
import { cached, useQuery } from '@/lib/store/dataVersion';

import type { CalendarMarker, DayMarker } from './dayLabel';
import { buildAheadMarkers, buildDayMarkers, sameMarker } from './markers';

/**
 * The last marker handed out per day. An unchanged day keeps its object across writes, so the
 * month list and the day strip only redraw the days whose drawing actually changed.
 */
const lastMarkers = new Map<string, CalendarMarker>();

function stabilise<T extends CalendarMarker>(map: Map<string, T>): Map<string, T> {
  for (const [date, marker] of map) {
    const previous = lastMarkers.get(date);
    if (previous && sameMarker(previous, marker)) map.set(date, previous as T);
    else lastMarkers.set(date, marker);
  }
  return map;
}

/** Every day with entries, for the calendar and the day strip alike. */
export function useDayMarkers(): ReadonlyMap<string, DayMarker> {
  const catalog = useCatalog();
  return useQuery(
    () =>
      cached('dayMarkers', () =>
        stabilise(
          buildDayMarkers(
            listEntryMoods(getDb()),
            (id) => catalog.moodById.get(id)?.icon as IconName | undefined,
            (level) => levelMood(catalog, level).icon,
          ),
        ),
      ),
    [catalog],
  );
}

/**
 * Days with entries plus future days with plans or an outlook, for the calendar and the day strip.
 * The outlook's ring only appears where the backtest let it through and the switch is on.
 */
export function useCalendarMarkers(today: DateString): ReadonlyMap<string, CalendarMarker> {
  const catalog = useCatalog();
  const days = useDayMarkers();
  const plans = useFuturePlans(today);
  const { enabled, outlook } = useOutlook(today);
  return useMemo(() => {
    const levels = new Map<DateString, { level: MoodLevel; icon: IconName }>();
    if (enabled && outlook?.status === 'ready') {
      for (const day of outlook.days) if (day.range) levels.set(day.date, { level: day.range.mid, icon: levelMood(catalog, day.range.mid).icon });
    }
    const ahead = buildAheadMarkers(plans, levels, (id) => {
      const activity = catalog.activityById.get(id);
      return activity ? { icon: activity.icon as IconName, name: activityLabel(catalog, id) } : undefined;
    });
    if (ahead.size === 0) return days;
    const merged = new Map<string, CalendarMarker>(days);
    for (const [date, marker] of stabilise(ahead)) if (date > today) merged.set(date, marker);
    return merged;
  }, [catalog, days, plans, enabled, outlook, today]);
}
