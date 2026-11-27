import { z } from 'zod';

import { ENTRY_SOURCES, SCALE_KINDS } from '@/db/schema';
import { addDaysToDateString, daysBetween, isDateString, type DateString } from '@/lib/dates';
import { MAX_EXPERIMENT_DAYS, TITLE_MAX_LENGTH } from '@/lib/experiments/rules';
import { latestReminderTime, reminderTimesOr } from '@/lib/notifications/times';
import { isPhotoName } from '@/lib/photos/store';
import { countByYear, TURNING_POINTS_PER_YEAR } from '@/lib/turning/rules';

/**
 * The Daylight JSON format: every table of the database, ids included, so a replace-import
 * restores the journal exactly. `app` tells it apart from other apps' exports (Zyklus has a
 * `schema_version` too). Referential integrity is checked here, before any row is written.
 * Version 2 added `entry_photos`; the photo files themselves travel next to the JSON in a ZIP.
 * `health_days` is optional and only there when the user opted in; older app versions skip it.
 * `turning_points` is optional too: backups from before they existed simply have none. A scale's
 * `kind` likewise: older backups hold ratings only. `settings.reminder_times` is optional as well:
 * a backup from before several reminders a day has the one `reminder_time`, which becomes the list.
 * `experiments` and `experiment_days` are optional the same way (no version bump): older app
 * versions drop them, and a replace with a backup without them leaves no experiments behind.
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
  // Backups from before durations have no kind; their scales are all ratings.
  kind: z.enum(SCALE_KINDS).default('rating'),
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

export const turningPointSchema = z.object({
  date: dateString,
  title: name,
  note: z.string().nullable(),
  created_at: isoTimestamp,
  updated_at: isoTimestamp,
});

export const experimentSchema = z.object({
  id,
  title: name.max(TITLE_MAX_LENGTH),
  note: z.string().nullable(),
  start_date: dateString,
  end_date: dateString,
  check_in: z.boolean(),
  result_seen: z.boolean(),
  created_at: isoTimestamp,
  updated_at: isoTimestamp,
});

export const experimentDaySchema = z.object({ experiment_id: id, date: dateString, kept: z.boolean() });

export const settingsSchema = z
  .object({
    first_day_of_week: z.number().int().min(0).max(6),
    reminder_enabled: z.boolean(),
    reminder_time: timeString,
    // Anything is taken and tidied below instead of refusing the whole backup over a reminder time.
    reminder_times: z.unknown().optional(),
    app_lock_enabled: z.boolean(),
    app_lock_delay_seconds: z.number().int().min(0),
    outlook_enabled: z.boolean(),
    // Optional without a default: backups from before the morning reminder leave the choice on this
    // device alone, since a replace writes these settings as they come.
    reminder_yesterday_enabled: z.boolean().optional(),
    reminder_yesterday_time: timeString.optional(),
    reminder_always: z.boolean().optional(),
    // Optional for the same reason: backups from before the seasonal designs leave them alone.
    design_seasons: z.boolean().optional(),
    design_festivals: z.boolean().optional(),
    // Optional for the same reason: backups from before the morning outlook leave it alone.
    outlook_notify_enabled: z.boolean().optional(),
    outlook_notify_time: timeString.optional(),
  })
  // The list as the app keeps it: valid times only, none twice, at most five, sorted. Without a
  // usable list (an older backup, a broken one) the single `reminder_time` is the list. Either way
  // `reminder_time` ends up as the latest time, as everywhere else.
  .transform((settings) => {
    const reminder_times = reminderTimesOr(settings.reminder_times, settings.reminder_time);
    return { ...settings, reminder_times, reminder_time: latestReminderTime(reminder_times) };
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
    turning_points: z.array(turningPointSchema).optional(),
    experiments: z.array(experimentSchema).optional(),
    experiment_days: z.array(experimentDaySchema).optional(),
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
    const turning = (payload.turning_points ?? []).map((point) => point.date);
    check(new Set(turning).size === turning.length, 'doppelte Wendepunkte');
    for (const [year, n] of countByYear(turning)) check(n <= TURNING_POINTS_PER_YEAR, `zu viele Wendepunkte in ${year}`);
    const experimentList = payload.experiments ?? [];
    const experimentIds = ids(experimentList);
    check(experimentIds.size === experimentList.length, 'doppelte Experiment-ids');
    // More lenient than the app (1 instead of 7 days), so an import does not fail at the edge.
    for (const experiment of experimentList) {
      const length = daysBetween(experiment.start_date as DateString, experiment.end_date as DateString) + 1;
      check(length >= 1 && length <= MAX_EXPERIMENT_DAYS, `Experiment ${experiment.id}: Zeitraum ungültig`);
    }
    const answers = payload.experiment_days ?? [];
    const spans = new Map(experimentList.map((experiment) => [experiment.id, experiment]));
    for (const answer of answers) {
      const experiment = spans.get(answer.experiment_id);
      check(!!experiment, 'Verweis in experiment_days ungültig');
      if (!experiment) continue;
      // Answers lie in the span; only the "no" that ended it lies on the day after its end.
      const endedByNo = !answer.kept && answer.date === addDaysToDateString(experiment.end_date as DateString, 1);
      check(answer.date >= experiment.start_date && (answer.date <= experiment.end_date || endedByNo), `Experiment ${experiment.id}: Antwort außerhalb des Zeitraums`);
    }
    check(new Set(answers.map((answer) => `${answer.experiment_id}|${answer.date}`)).size === answers.length, 'doppelte Antworten in experiment_days');
  });

export type ExportPayload = z.infer<typeof exportSchema>;
export type ExportSettings = z.infer<typeof settingsSchema>;
export type ExportPhoto = ExportPayload['entry_photos'][number];
export type ExportHealthDay = z.infer<typeof healthDaySchema>;
export type ExportTurningPoint = z.infer<typeof turningPointSchema>;
export type ExportExperiment = z.infer<typeof experimentSchema>;
export type ExportExperimentDay = z.infer<typeof experimentDaySchema>;
