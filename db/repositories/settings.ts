import { eq } from 'drizzle-orm';

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

export function updateSettings(db: Database, patch: SettingsPatch): Settings {
  if (patch.reminder_time !== undefined) assertTime(patch.reminder_time, 'reminder_time');
  if (patch.reminder_yesterday_time !== undefined) assertTime(patch.reminder_yesterday_time, 'reminder_yesterday_time');
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
    .set({ ...patch, updated_at: now() })
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
