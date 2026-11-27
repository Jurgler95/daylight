import { eq } from 'drizzle-orm';

import { cleanReminderTimes, latestReminderTime } from '@/lib/notifications/times';

import { settings, type Settings } from '../schema';
import { RepositoryError, type Database } from '../types';
import { assertDate, assertTime, now } from '../validate';

export type SettingsPatch = Partial<Omit<Settings, 'id' | 'created_at' | 'updated_at'>>;

export function ensureSettings(db: Database): Settings {
  db.insert(settings).values({ id: 1 }).onConflictDoNothing().run();
  return getSettings(db);
}

export function getSettings(db: Database): Settings {
  const row = db.select().from(settings).where(eq(settings.id, 1)).get();
  if (!row) throw new RepositoryError('settings row missing; run migrations first');
  return row;
}

/**
 * The two columns of the daily reminder's times always move together. A list is cleaned (invalid and
 * repeated times go, at most five stay, sorted) and `reminder_time` follows with its latest; a single
 * `reminder_time` on its own, as the start sheet sets it, becomes a list of that one time.
 */
function reminderTimesPatch(patch: SettingsPatch): Pick<SettingsPatch, 'reminder_time' | 'reminder_times'> {
  if (patch.reminder_times !== undefined) {
    const times = cleanReminderTimes(patch.reminder_times);
    if (times.length === 0) throw new RepositoryError('reminder_times needs at least one HH:mm');
    return { reminder_times: times, reminder_time: latestReminderTime(times) };
  }
  if (patch.reminder_time !== undefined) {
    return { reminder_time: assertTime(patch.reminder_time, 'reminder_time'), reminder_times: [patch.reminder_time] };
  }
  return {};
}

export function updateSettings(db: Database, patch: SettingsPatch): Settings {
  const times = reminderTimesPatch(patch);
  if (patch.reminder_yesterday_time !== undefined) assertTime(patch.reminder_yesterday_time, 'reminder_yesterday_time');
  if (patch.outlook_notify_time !== undefined) assertTime(patch.outlook_notify_time, 'outlook_notify_time');
  if (patch.streak_rescue_dismissed) assertDate(patch.streak_rescue_dismissed, 'streak_rescue_dismissed');
  if (patch.low_mood_dismissed_on) assertDate(patch.low_mood_dismissed_on, 'low_mood_dismissed_on');
  if (patch.health_synced_from) assertDate(patch.health_synced_from, 'health_synced_from');
  if (patch.first_day_of_week !== undefined && (patch.first_day_of_week < 0 || patch.first_day_of_week > 6)) {
    throw new RepositoryError('first_day_of_week must be 0..6');
  }
  if (patch.app_lock_delay_seconds !== undefined && patch.app_lock_delay_seconds < 0) {
    throw new RepositoryError('app_lock_delay_seconds must be >= 0');
  }
  return db
    .update(settings)
    .set({ ...patch, ...times, updated_at: now() })
    .where(eq(settings.id, 1))
    .returning()
    .get();
}

/**
 * Whoever already has the reminder on never needs the start sheet that offers it. Runs on every
 * start instead of as a data migration, so installations from before the sheet are covered too.
 */
export function settleReminderPrompt(db: Database): Settings {
  const row = getSettings(db);
  return row.reminder_enabled && !row.reminder_prompt_done ? updateSettings(db, { reminder_prompt_done: true }) : row;
}
