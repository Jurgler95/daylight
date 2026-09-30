import { listActivities } from '@/db/repositories/activities';
import { listEntryDetails } from '@/db/repositories/entries';
import { listMoods } from '@/db/repositories/moods';
import { listScales } from '@/db/repositories/scales';
import type { Database } from '@/db/types';
import type { DateString } from '@/lib/dates';

import type { DaylioRow } from './write';

/** Reads every entry as a Daylio row: mood by name, activities in group and sort order. */
export function readDaylioRows(db: Database): DaylioRow[] {
  const moods = new Map(listMoods(db, { includeArchived: true }).map((mood) => [mood.id, mood.label]));
  const ordered = listActivities(db, { includeArchived: true });
  const rank = new Map(ordered.map((activity, index) => [activity.id, index]));
  const names = new Map(ordered.map((activity) => [activity.id, activity.name]));
  const scales = listScales(db, { includeArchived: true });
  const scaleRank = new Map(scales.map((scale, index) => [scale.id, index]));
  const scaleNames = new Map(scales.map((scale) => [scale.id, scale.name]));

  return listEntryDetails(db).map((entry) => ({
    date: entry.date as DateString,
    time: entry.time,
    mood: moods.get(entry.mood_id) ?? '',
    activities: [...entry.activity_ids].sort((a, b) => (rank.get(a) ?? 0) - (rank.get(b) ?? 0)).map((id) => names.get(id) ?? ''),
    scales: [...entry.scales]
      .sort((a, b) => (scaleRank.get(a.scale_id) ?? 0) - (scaleRank.get(b.scale_id) ?? 0))
      .map((scale) => ({ name: scaleNames.get(scale.scale_id) ?? '', value: scale.value })),
    noteTitle: entry.note_title,
    note: entry.note,
  }));
}
