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
/**
 * `rating` is a row of steps from min to max; `duration` holds minutes (0 to a day); `number` is any
 * measured value like a weight, with a unit and up to two decimals and no fixed range.
 */
export const SCALE_KINDS = ['rating', 'duration', 'number'] as const;
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
  /**
   * The activities of this group say how the day felt ("Glücklich", "Gestresst") instead of what happened.
   * The links on "Einblicke" list them apart and keep them out of the test of everything else (`lib/insights/links.ts`).
   */
  describes_mood: integer('describes_mood', { mode: 'boolean' }).notNull().default(false),
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
  kind: text('kind', { enum: SCALE_KINDS }).notNull().default('rating'),
  /** Only for `number`: what is measured in, like "kg", and how many decimals are entered (0 to 2). */
  unit: text('unit').notNull().default(''),
  decimals: integer('decimals').notNull().default(0),
  sort_order: integer('sort_order').notNull().default(0),
  archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
  /** The scale rates the mood itself (contentment, tension), like `activityGroups.describes_mood`. */
  describes_mood: integer('describes_mood', { mode: 'boolean' }).notNull().default(false),
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
    // Whole numbers for ratings and durations. A `number` scale may hold a decimal like 72.4: SQLite
    // keeps it as REAL in this column (integer affinity only converts what fits without loss).
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
  /** "HH:mm": the latest time of `reminder_times`. Entries in the real data cluster between 20:00 and 21:45. */
  reminder_time: text('reminder_time').notNull().default('20:30'),
  /**
   * Every time of the daily reminder as a JSON list of "HH:mm", one to five, sorted (`lib/notifications/times.ts`).
   * `reminder_time` always holds the latest of them, for older app versions reading a newer backup. Part of the backup.
   */
  reminder_times: text('reminder_times', { mode: 'json' }).$type<string[]>().notNull().default(['20:30']),
  app_lock_enabled: integer('app_lock_enabled', { mode: 'boolean' }).notNull().default(false),
  app_lock_delay_seconds: integer('app_lock_delay_seconds').notNull().default(0),
  outlook_enabled: integer('outlook_enabled', { mode: 'boolean' }).notNull().default(true),
  /** A `Language` ("de", "en", ...); null follows the device. Device-local, never exported. */
  language: text('language', { enum: ['de', 'en', 'es', 'pt', 'fr', 'it', 'nl', 'pl', 'tr', 'id'] }),
  /** "light" or "dark" ("Erscheinungsbild" under "Mehr"); null follows the device. Device-local like the language, never exported. */
  color_scheme: text('color_scheme', { enum: ['light', 'dark'] }),
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
  /** Stars per achievement already announced, as JSON; null before the first check. Device-local, never exported. */
  achievements_seen: text('achievements_seen'),
  /** How often the app was opened (`lib/achievements/opens.ts`). Device-local, never exported. */
  app_opens: integer('app_opens').notNull().default(0),
  /** Opt-in: the health days go into the JSON backup. Device-local; an import that brings health days turns it on. */
  health_in_backup: integer('health_in_backup', { mode: 'boolean' }).notNull().default(false),
  /** Morning reminder on a day whose yesterday has no entry yet. Only with `reminder_enabled`; part of the backup like it. */
  reminder_yesterday_enabled: integer('reminder_yesterday_enabled', { mode: 'boolean' }).notNull().default(true),
  /** "HH:mm" of the morning reminder. Part of the backup. */
  reminder_yesterday_time: text('reminder_yesterday_time').notNull().default('10:00'),
  /** The daily reminder comes even when there already is an entry for its part of the day. Only with `reminder_enabled`; part of the backup like it. */
  reminder_always: integer('reminder_always', { mode: 'boolean' }).notNull().default(false),
  /** The start sheet offering the reminder was answered, or never needed (reminder already on). Device-local, never exported. */
  reminder_prompt_done: integer('reminder_prompt_done', { mode: 'boolean' }).notNull().default(false),
  /** Highest streak length celebrated, as JSON `{ start, days }` (`lib/streak/celebration.ts`). Device-local, never exported. */
  streak_celebrated: text('streak_celebrated'),
  /** Day the rescue card for a broken streak was last put away ("YYYY-MM-DD"). Device-local, never exported. */
  streak_rescue_dismissed: text('streak_rescue_dismissed'),
  /** "Design zur Jahreszeit": app and launcher icon follow the season (`lib/seasons`). Part of the backup. */
  design_seasons: integer('design_seasons', { mode: 'boolean' }).notNull().default(true),
  /** "Designs zu Festen": festivals win over the season. Only with `design_seasons`; part of the backup like it. */
  design_festivals: integer('design_festivals', { mode: 'boolean' }).notNull().default(true),
  /** Opt-in: a morning notification on a day the hint for a good next day pointed at. Only with `outlook_enabled`; part of the backup. */
  outlook_notify_enabled: integer('outlook_notify_enabled', { mode: 'boolean' }).notNull().default(false),
  /** "HH:mm" of that notification. Part of the backup. */
  outlook_notify_time: text('outlook_notify_time').notNull().default('08:00'),
  /** The card asking for a Play Store rating was answered ("Bewerten" or "Nicht jetzt", `lib/review`). Device-local, never exported. */
  review_prompt_done: integer('review_prompt_done', { mode: 'boolean' }).notNull().default(false),
  /** Folder for the automatic backup, the content:// URI Android's folder picker handed out (`lib/export/auto.ts`); null while it is off. Device-local, never exported. */
  auto_backup_dir: text('auto_backup_dir'),
  /** ISO timestamp of the last automatic backup that worked. Device-local, never exported. */
  auto_backup_at: text('auto_backup_at'),
  /** ISO timestamp of the last attempt, worked or not; keeps a failing folder from being tried after every save. Device-local, never exported. */
  auto_backup_tried_at: text('auto_backup_tried_at'),
  /** Message of the last failed attempt, cleared by the next one that works. Device-local, never exported. */
  auto_backup_error: text('auto_backup_error'),
  /** Fingerprint of the data in the last automatic backup, so an unchanged diary is not written again. Device-local, never exported. */
  auto_backup_hash: text('auto_backup_hash'),
  /** Day the card on "Heute" asking for a backup was last put away ("YYYY-MM-DD"). Device-local, never exported. */
  backup_hint_dismissed_on: text('backup_hint_dismissed_on'),
  ...timestamps,
});

/**
 * One row per day with data from Health Connect, only ever overwritten by a sync. A value is null
 * when Health Connect had nothing for it that day. Part of the JSON backup only when the user opts
 * in (`settings.health_in_backup`); days restored from a backup are marked, so a sync that finds
 * nothing for them leaves them alone.
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
  /** Came from a backup, not from a sync on this device. A sync with values for the day takes it over. */
  restored: integer('restored', { mode: 'boolean' }).notNull().default(false),
});

/**
 * A day the user marks as a turning point (a move, a new job), to compare the days before it with
 * the days after. At most one per day and `TURNING_POINTS_PER_YEAR` per calendar year of its date.
 */
export const turningPoints = sqliteTable('turning_points', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  date: text('date').notNull().unique(),
  title: text('title').notNull(),
  note: text('note'),
  ...timestamps,
});

/**
 * Something the user tries for a while ("no coffee after 2 pm"), to compare the days before it with
 * the days during it. The state (planned, running, over) is never stored but follows from the dates.
 * There is no column for the planned length: `end_date` (inclusive) is set from start and length on
 * creation and moved when the experiment is ended early.
 */
export const experiments = sqliteTable('experiments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  note: text('note'),
  start_date: text('start_date').notNull(),
  end_date: text('end_date').notNull(),
  /** Ask "kept today?" in the entry editor. */
  check_in: integer('check_in', { mode: 'boolean' }).notNull().default(false),
  /** The card on "Heute" after the end was opened or put away (or never needed). */
  result_seen: integer('result_seen', { mode: 'boolean' }).notNull().default(false),
  ...timestamps,
});

/** The answer to "kept today?" for one day of an experiment. Belongs to the day, not to an entry. */
export const experimentDays = sqliteTable(
  'experiment_days',
  {
    experiment_id: integer('experiment_id')
      .notNull()
      .references(() => experiments.id, { onDelete: 'cascade' }),
    date: text('date').notNull(),
    kept: integer('kept', { mode: 'boolean' }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.experiment_id, t.date] })],
);

/**
 * Days on which "Heute" showed the hint for a good next day, so it comes about once to four times
 * in two weeks however long the app was closed. Not part of exports: it only paces the hint.
 */
export const tomorrowHints = sqliteTable('tomorrow_hints', {
  date: text('date').primaryKey(),
  /**
   * The hint as it was last on screen, as JSON (`GoodTomorrow`), so the next morning shows exactly
   * that and the morning notification only comes while there is one. Null once that day's hint is
   * gone again (its entry changed that evening); the day still counts towards the two weeks.
   */
  hint: text('hint'),
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
export type TurningPoint = typeof turningPoints.$inferSelect;
export type Experiment = typeof experiments.$inferSelect;
export type ExperimentDay = typeof experimentDays.$inferSelect;
export type EntrySource = (typeof ENTRY_SOURCES)[number];
export type ScaleKind = (typeof SCALE_KINDS)[number];
export type MoodLevel = (typeof MOOD_LEVELS)[number];
