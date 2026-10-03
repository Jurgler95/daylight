import { listHealthDays } from '@/db/repositories/health';
import { getSettings } from '@/db/repositories/settings';
import { activities, activityGroups, entries, entryActivities, entryPhotos, entryScales, moods, plannedActivities, scales } from '@/db/schema';
import type { Database } from '@/db/types';

import { EXPORT_APP, EXPORT_SCHEMA_VERSION, type ExportPayload, type ExportSettings } from './schema';

/**
 * last_export_at, low_mood_dismissed_on, the announced stars, the number of app opens, the language and the Health Connect state describe this device, not the
 * data, so they stay out of the snapshot. The health days themselves only go in when the user opted in.
 */
export function settingsForExport(row: ReturnType<typeof getSettings>): ExportSettings {
  const {
    id: _id,
    created_at: _c,
    updated_at: _u,
    last_export_at: _l,
    low_mood_dismissed_on: _d,
    language: _lang,
    health_enabled: _he,
    health_synced_from: _hf,
    health_last_sync_at: _hs,
    health_last_error: _hr,
    achievements_seen: _as,
    app_opens: _ao,
    health_in_backup: _hb,
    ...rest
  } = row;
  return rest;
}

/** Complete snapshot of the database, every table sorted by its key. Ids are kept for a replace-import. */
export function buildExport(db: Database, appVersion: string, exportedAt = new Date().toISOString()): ExportPayload {
  const byId = <T extends { id: number }>(rows: T[]) => rows.sort((a, b) => a.id - b.id);
  const settings = getSettings(db);
  return {
    app: EXPORT_APP,
    schema_version: EXPORT_SCHEMA_VERSION,
    app_version: appVersion,
    exported_at: exportedAt,
    settings: settingsForExport(settings),
    moods: byId(db.select().from(moods).all()),
    activity_groups: byId(db.select().from(activityGroups).all()),
    activities: byId(db.select().from(activities).all()),
    scales: byId(db.select().from(scales).all()),
    entries: byId(db.select().from(entries).all()),
    entry_activities: db
      .select()
      .from(entryActivities)
      .all()
      .sort((a, b) => a.entry_id - b.entry_id || a.activity_id - b.activity_id),
    entry_scales: db
      .select()
      .from(entryScales)
      .all()
      .sort((a, b) => a.entry_id - b.entry_id || a.scale_id - b.scale_id),
    planned_activities: db
      .select()
      .from(plannedActivities)
      .all()
      .sort((a, b) => a.date.localeCompare(b.date) || a.activity_id - b.activity_id),
    entry_photos: db
      .select()
      .from(entryPhotos)
      .all()
      .sort((a, b) => a.entry_id - b.entry_id || a.sort_order - b.sort_order || a.id - b.id)
      .map(({ entry_id, file_name, sort_order, created_at }) => ({ entry_id, file_name, sort_order, created_at })),
    ...(settings.health_in_backup ? { health_days: listHealthDays(db).map(({ restored: _r, ...day }) => day) } : {}),
  };
}

export function exportFileName(date: string): string {
  return `daylight-export-${date}.json`;
}
