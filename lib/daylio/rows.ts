import { listActivities } from '@/db/repositories/activities';
import { listEntryDetails } from '@/db/repositories/entries';
import { listMoods } from '@/db/repositories/moods';
import { listScales } from '@/db/repositories/scales';
import type { Database } from '@/db/types';
import type { DateString } from '@/lib/dates';

import type { DaylioRow } from './write';

/** Reads every entry as a Daylio row: mood by name, activities in group and sort order. */
/** Digits after the point of a stored value; twelve significant digits drop the binary noise. */
function digitsOf(value: number): number {
  const text = String(Number(value.toPrecision(12)));
  const point = text.indexOf('.');
  return point < 0 ? 0 : text.length - point - 1;
}

export function readDaylioRows(db: Database): DaylioRow[] {
  const moods = new Map(listMoods(db, { includeArchived: true }).map((mood) => [mood.id, mood.label]));
  const ordered = listActivities(db, { includeArchived: true });
  const rank = new Map(ordered.map((activity, index) => [activity.id, index]));
  const names = new Map(ordered.map((activity) => [activity.id, activity.name]));
  const scales = listScales(db, { includeArchived: true });
  const scaleRank = new Map(scales.map((scale, index) => [scale.id, index]));
  const scaleNames = new Map(scales.map((scale) => [scale.id, scale.name]));
  // A number scale always writes its decimals, at least one ("Gläser: 6.0"), so an import knows it is no rating.
  const numberDecimals = new Map(scales.filter((scale) => scale.kind === 'number').map((scale) => [scale.id, Math.max(1, scale.decimals)]));

  return listEntryDetails(db).map((entry) => ({
    date: entry.date as DateString,
    time: entry.time,
    mood: moods.get(entry.mood_id) ?? '',
    activities: [...entry.activity_ids].sort((a, b) => (rank.get(a) ?? 0) - (rank.get(b) ?? 0)).map((id) => names.get(id) ?? ''),
    scales: [...entry.scales]
      .sort((a, b) => (scaleRank.get(a.scale_id) ?? 0) - (scaleRank.get(b.scale_id) ?? 0))
      .map((scale) => {
        const least = numberDecimals.get(scale.scale_id);
        // More when the value holds more, e.g. after the setting went from 2 decimals to 1.
        const decimals = least === undefined ? undefined : Math.max(least, digitsOf(scale.value));
        return { name: scaleNames.get(scale.scale_id) ?? '', value: scale.value, ...(decimals === undefined ? {} : { decimals }) };
      }),
    noteTitle: entry.note_title,
    note: entry.note,
  }));
}
