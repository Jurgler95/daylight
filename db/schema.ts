import { sql } from 'drizzle-orm';
import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/**
 * Calendar days are "YYYY-MM-DD", times of day "HH:mm", never timestamps.
 * Booleans are stored as integers (0/1). Only `created_at`/`updated_at` are ISO timestamps.
 */

const timestamps = {
  created_at: text('created_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  updated_at: text('updated_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
};

export const ENTRY_SOURCES = ['app', 'daylio_csv', 'json'] as const;
export const MOOD_LEVELS = [1, 2, 3, 4, 5] as const;

/** Every mood hangs on a level 1 (worst) to 5 (best), so every analysis can do arithmetic on it. */
export const moods = sqliteTable('moods', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  label: text('label').notNull(),
  level: integer('level').notNull(),
  /** MaterialCommunityIcons glyph name. */
  icon: text('icon').notNull(),
  sort_order: integer('sort_order').notNull().default(0),
  archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
});

export const activityGroups = sqliteTable('activity_groups', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  sort_order: integer('sort_order').notNull().default(0),
  archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
});

export const activities = sqliteTable(
  'activities',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    group_id: integer('group_id')
      .notNull()
      .references(() => activityGroups.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    /** MaterialCommunityIcons glyph name. */
    icon: text('icon').notNull(),
    sort_order: integer('sort_order').notNull().default(0),
    archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
  },
  (t) => [uniqueIndex('activities_group_name').on(t.group_id, t.name)],
);

/** Several entries per day are allowed; the day's mood is the mean of their levels. */
export const entries = sqliteTable(
  'entries',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    date: text('date').notNull(),
    time: text('time').notNull(),
    mood_id: integer('mood_id')
      .notNull()
      .references(() => moods.id, { onDelete: 'restrict' }),
    note_title: text('note_title'),
    note: text('note'),
    source: text('source', { enum: ENTRY_SOURCES }).notNull().default('app'),
    ...timestamps,
  },
  (t) => [index('entries_date').on(t.date)],
);

export const entryActivities = sqliteTable(
  'entry_activities',
  {
    entry_id: integer('entry_id')
      .notNull()
      .references(() => entries.id, { onDelete: 'cascade' }),
    activity_id: integer('activity_id')
      .notNull()
      .references(() => activities.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.entry_id, t.activity_id] }), index('entry_activities_activity').on(t.activity_id)],
);

export const scales = sqliteTable('scales', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  min: integer('min').notNull().default(0),
  max: integer('max').notNull().default(10),
  sort_order: integer('sort_order').notNull().default(0),
  archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
});

export const entryScales = sqliteTable(
  'entry_scales',
  {
    entry_id: integer('entry_id')
      .notNull()
      .references(() => entries.id, { onDelete: 'cascade' }),
    scale_id: integer('scale_id')
      .notNull()
      .references(() => scales.id, { onDelete: 'cascade' }),
    value: integer('value').notNull(),
  },
  (t) => [primaryKey({ columns: [t.entry_id, t.scale_id] })],
);

/**
 * Photos are files in the app's private folder (`lib/photos`); a row only names the file. The name
 * is unique, so an import can tell a photo it already brought in (Daylio photos keep their checksum).
 */
export const entryPhotos = sqliteTable(
  'entry_photos',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    entry_id: integer('entry_id')
      .notNull()
      .references(() => entries.id, { onDelete: 'cascade' }),
    file_name: text('file_name').notNull(),
    sort_order: integer('sort_order').notNull().default(0),
    created_at: timestamps.created_at,
  },
  (t) => [uniqueIndex('entry_photos_file').on(t.file_name), index('entry_photos_entry').on(t.entry_id)],
);

/** What is planned for a future day (holiday, visit, work). Input for the outlook in phase 4. */
export const plannedActivities = sqliteTable(
  'planned_activities',
  {
    date: text('date').notNull(),
    activity_id: integer('activity_id')
      .notNull()
      .references(() => activities.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.date, t.activity_id] })],
);

/** Typed singleton: exactly one row with id = 1. */
export const settings = sqliteTable('settings', {
  id: integer('id').primaryKey(),
  /** 0 = Sunday, 1 = Monday. */
  first_day_of_week: integer('first_day_of_week').notNull().default(1),
  reminder_enabled: integer('reminder_enabled', { mode: 'boolean' }).notNull().default(false),
  /** "HH:mm". Entries in the real data cluster between 20:00 and 21:45. */
  reminder_time: text('reminder_time').notNull().default('20:30'),
  app_lock_enabled: integer('app_lock_enabled', { mode: 'boolean' }).notNull().default(false),
  app_lock_delay_seconds: integer('app_lock_delay_seconds').notNull().default(0),
  outlook_enabled: integer('outlook_enabled', { mode: 'boolean' }).notNull().default(true),
  /** ISO timestamp of the last full JSON backup. Device-local, never part of an export. */
  last_export_at: text('last_export_at'),
  /** Day the low mood note on "Heute" was last put away ("YYYY-MM-DD"). Device-local, never exported. */
  low_mood_dismissed_on: text('low_mood_dismissed_on'),
  /** Read from Health Connect on every return to the app. Device-local, never exported. */
  health_enabled: integer('health_enabled', { mode: 'boolean' }).notNull().default(false),
  /** Oldest day the backfill has read ("YYYY-MM-DD"), null before the first run. Device-local. */
  health_synced_from: text('health_synced_from'),
  /** ISO timestamp of the last finished sync. Device-local. */
  health_last_sync_at: text('health_last_sync_at'),
  /** Message of the last failed sync, cleared by the next one that works. Device-local. */
  health_last_error: text('health_last_error'),
  ...timestamps,
});

/**
 * One row per day with data from Health Connect, only ever overwritten by a sync. A value is null
 * when Health Connect had nothing for it that day. Device-local: never part of an export, since a
 * new sync brings it back.
 */
export const healthDays = sqliteTable('health_days', {
  date: text('date').primaryKey(),
  steps: integer('steps'),
  /** Minutes asleep in sleep that ended on this day (awake stages left out). */
  sleep_minutes: integer('sleep_minutes'),
  /** Mean resting heart rate of the day, beats per minute, rounded. */
  resting_hr: integer('resting_hr'),
  exercise_minutes: integer('exercise_minutes'),
  synced_at: text('synced_at').notNull(),
});

export type Mood = typeof moods.$inferSelect;
export type NewMood = typeof moods.$inferInsert;
export type ActivityGroup = typeof activityGroups.$inferSelect;
export type Activity = typeof activities.$inferSelect;
export type Entry = typeof entries.$inferSelect;
export type NewEntry = typeof entries.$inferInsert;
export type EntryActivity = typeof entryActivities.$inferSelect;
export type Scale = typeof scales.$inferSelect;
export type EntryScale = typeof entryScales.$inferSelect;
export type EntryPhoto = typeof entryPhotos.$inferSelect;
export type PlannedActivity = typeof plannedActivities.$inferSelect;
export type Settings = typeof settings.$inferSelect;
export type HealthDay = typeof healthDays.$inferSelect;
export type EntrySource = (typeof ENTRY_SOURCES)[number];
export type MoodLevel = (typeof MOOD_LEVELS)[number];
