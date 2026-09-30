import { drizzle } from 'drizzle-orm/expo-sqlite';
import { deleteDatabaseSync, openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';

import * as schema from './schema';

export const DATABASE_NAME = 'daylight.db';

let sqlite: SQLiteDatabase | null = null;
let db: ReturnType<typeof createDrizzle> | null = null;

function createDrizzle(connection: SQLiteDatabase) {
  return drizzle(connection, { schema });
}

export function getSqlite(): SQLiteDatabase {
  if (!sqlite) {
    sqlite = openDatabaseSync(DATABASE_NAME, { enableChangeListener: true });
    sqlite.execSync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  }
  return sqlite;
}

export function getDb() {
  if (!db) db = createDrizzle(getSqlite());
  return db;
}

export type Database = ReturnType<typeof getDb>;

/** Closes and forgets the connection. Used by "delete all data" and tests. */
export function resetConnection(): void {
  sqlite?.closeSync();
  sqlite = null;
  db = null;
}

/**
 * Drops the database file itself, so nothing of the old data survives in free pages or the WAL.
 * The caller must run the migrations again afterwards.
 */
export function dropDatabaseFile(): void {
  resetConnection();
  deleteDatabaseSync(DATABASE_NAME);
}
