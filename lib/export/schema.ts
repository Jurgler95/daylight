import { z } from 'zod';

import { ENTRY_SOURCES } from '@/db/schema';
import { isDateString } from '@/lib/dates';
import { isPhotoName } from '@/lib/photos/store';

/**
 * The Daylight JSON format: every table of the database, ids included, so a replace-import
 * restores the journal exactly. `app` tells it apart from other apps' exports (Zyklus has a
 * `schema_version` too). Referential integrity is checked here, before any row is written.
 * Version 2 added `entry_photos`; the photo files themselves travel next to the JSON in a ZIP.
 * `health_days` is optional and only there when the user opted in; older app versions skip it.
 */

export const EXPORT_SCHEMA_VERSION = 2;
export const EXPORT_APP = 'daylight';

const id = z.number().int().positive();
const dateString = z.string().refine((value): boolean => isDateString(value), 'YYYY-MM-DD erwartet');
const timeString = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'HH:mm erwartet');
const name = z.string().trim().min(1);
const isoTimestamp = z.string().min(1);

export const moodSchema = z.object({
  id,
  label: name,
  level: z.number().int().min(1).max(5),
  icon: z.string().min(1),
  sort_order: z.number().int(),
  archived: z.boolean(),
});

export const groupSchema = z.object({ id, name, sort_order: z.number().int(), archived: z.boolean() });

export const activitySchema = z.object({
  id,
  group_id: id,
  name,
  icon: z.string().min(1),
  sort_order: z.number().int(),
  archived: z.boolean(),
});

export const scaleSchema = z.object({
  id,
  name,
  min: z.number().int(),
  max: z.number().int(),
  sort_order: z.number().int(),
  archived: z.boolean(),
});

export const entrySchema = z.object({
  id,
  date: dateString,
  time: timeString,
  mood_id: id,
  note_title: z.string().nullable(),
  note: z.string().nullable(),
  source: z.enum(ENTRY_SOURCES),
  created_at: isoTimestamp,
  updated_at: isoTimestamp,
});

const minutes = z.number().int().min(0).nullable();

export const healthDaySchema = z.object({
  date: dateString,
  steps: z.number().int().min(0).nullable(),
  sleep_minutes: minutes,
  resting_hr: z.number().int().positive().nullable(),
  exercise_minutes: minutes,
  synced_at: isoTimestamp,
});

export const settingsSchema = z.object({
  first_day_of_week: z.number().int().min(0).max(6),
  reminder_enabled: z.boolean(),
  reminder_time: timeString,
  app_lock_enabled: z.boolean(),
  app_lock_delay_seconds: z.number().int().min(0),
  outlook_enabled: z.boolean(),
});

export const exportSchema = z
  .object({
    app: z.literal(EXPORT_APP),
    schema_version: z.literal(EXPORT_SCHEMA_VERSION),
    app_version: z.string(),
    exported_at: isoTimestamp,
    settings: settingsSchema,
    moods: z.array(moodSchema),
    activity_groups: z.array(groupSchema),
    activities: z.array(activitySchema),
    scales: z.array(scaleSchema),
    entries: z.array(entrySchema),
    entry_activities: z.array(z.object({ entry_id: id, activity_id: id })),
    entry_scales: z.array(z.object({ entry_id: id, scale_id: id, value: z.number().int() })),
    planned_activities: z.array(z.object({ date: dateString, activity_id: id })),
    entry_photos: z.array(
      z.object({
        entry_id: id,
        file_name: z.string().refine((value): boolean => isPhotoName(value), 'Fotoname ungültig'),
        sort_order: z.number().int(),
        created_at: isoTimestamp,
      }),
    ),
    health_days: z.array(healthDaySchema).optional(),
  })
  .superRefine((payload, ctx) => {
    const ids = (rows: readonly { id: number }[]) => new Set(rows.map((row) => row.id));
    const [moods, groups, activities, scales, entries] = [
      ids(payload.moods),
      ids(payload.activity_groups),
      ids(payload.activities),
      ids(payload.scales),
      ids(payload.entries),
    ];
    const check = (ok: boolean, message: string) => {
      if (!ok) ctx.addIssue({ code: 'custom', message });
    };
    check(moods.size === payload.moods.length, 'doppelte Stimmungs-ids');
    check(entries.size === payload.entries.length, 'doppelte Eintrags-ids');
    for (const activity of payload.activities) check(groups.has(activity.group_id), `Aktivität ${activity.id}: Gruppe fehlt`);
    for (const entry of payload.entries) check(moods.has(entry.mood_id), `Eintrag ${entry.id}: Stimmung fehlt`);
    for (const link of payload.entry_activities) check(entries.has(link.entry_id) && activities.has(link.activity_id), 'Verweis in entry_activities ungültig');
    for (const value of payload.entry_scales) check(entries.has(value.entry_id) && scales.has(value.scale_id), 'Verweis in entry_scales ungültig');
    for (const plan of payload.planned_activities) check(activities.has(plan.activity_id), 'Verweis in planned_activities ungültig');
    for (const photo of payload.entry_photos) check(entries.has(photo.entry_id), 'Verweis in entry_photos ungültig');
    check(new Set(payload.entry_photos.map((photo) => photo.file_name)).size === payload.entry_photos.length, 'doppelte Fotonamen');
    const health = payload.health_days ?? [];
    check(new Set(health.map((day) => day.date)).size === health.length, 'doppelte Gesundheitstage');
  });

export type ExportPayload = z.infer<typeof exportSchema>;
export type ExportSettings = z.infer<typeof settingsSchema>;
export type ExportPhoto = ExportPayload['entry_photos'][number];
export type ExportHealthDay = z.infer<typeof healthDaySchema>;
