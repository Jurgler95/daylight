import { migrate } from 'drizzle-orm/expo-sqlite/migrator';

import migrations from '@/drizzle/migrations';

import { getDb } from './client';
import { ensureDefaults } from './repositories/defaults';

/**
 * Runs all pending Drizzle migrations, then guarantees the settings singleton and the default
 * moods and groups exist. Called once at app start before any screen renders.
 */
export async function runMigrations(): Promise<void> {
  const db = getDb();
  await migrate(db, migrations);
  ensureDefaults(db);
}
