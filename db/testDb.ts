import BetterSqlite3 from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'node:path';

import { ensureDefaults } from './repositories/defaults';
import * as schema from './schema';
import type { Database } from './types';

/**
 * In-memory database for Jest, migrated with the same SQL files the app ships and seeded with the
 * same defaults as a first start, minus the starter activities, so tests begin with empty groups.
 * Node-only: never import from app code.
 */
export function createTestDb(): Database {
  const sqlite = new BetterSqlite3(':memory:');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.join(__dirname, '..', 'drizzle') });
  ensureDefaults(db, undefined, { starters: false });
  return db;
}
