import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import type * as schema from './schema';

/**
 * Any synchronous Drizzle SQLite database with our schema.
 * expo-sqlite (app) and better-sqlite3 (tests) both satisfy this.
 */
export type Database = BaseSQLiteDatabase<'sync', unknown, typeof schema>;

export class RepositoryError extends Error {
  override readonly name: string = 'RepositoryError';
}

/** A rename or move would give two items of the same list the same (folded) name. */
export class NameTakenError extends RepositoryError {
  override readonly name: string = 'NameTakenError';
  constructor(readonly taken: string) {
    super(`name "${taken}" is already taken`);
  }
}

/** Archiving would leave no mood to pick from. */
export class LastMoodError extends RepositoryError {
  override readonly name: string = 'LastMoodError';
}
