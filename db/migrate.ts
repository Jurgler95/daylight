import { migrate } from 'drizzle-orm/expo-sqlite/migrator';

import migrations from '@/drizzle/migrations';
import { deviceLanguage } from '@/lib/i18n/language';

import { getDb } from './client';
import { ensureDefaults } from './repositories/defaults';
import { ensureSettings } from './repositories/settings';

/**
 * Runs all pending Drizzle migrations, then guarantees the settings singleton and the default
 * moods and groups exist. Called once at app start before any screen renders.
 */
export async function runMigrations(): Promise<void> {
  const db = getDb();
  await migrate(db, migrations);
  // Before the settings store loads, so the first start names moods and groups in the device's language.
  ensureDefaults(db, ensureSettings(db).language ?? deviceLanguage());
}
