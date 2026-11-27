import BetterSqlite3 from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { getSettings } from '../repositories/settings';
import * as schema from '../schema';

/**
 * The update from a version with one reminder time: the database is first migrated up to the step
 * before `reminder_times` (a copy of the migrations folder with a shortened journal), gets its
 * settings row as that version wrote it, and is then migrated with the real folder.
 */
const FOLDER = path.join(__dirname, '..', '..', 'drizzle');
const TAG = '0017_hesitant_morgan_stark';

function migratedBefore(dir: string) {
  cpSync(FOLDER, dir, { recursive: true });
  const journalFile = path.join(dir, 'meta', '_journal.json');
  const journal = JSON.parse(readFileSync(journalFile, 'utf8')) as { entries: { tag: string }[] };
  const index = journal.entries.findIndex((entry) => entry.tag === TAG);
  expect(index).toBeGreaterThan(0);
  writeFileSync(journalFile, JSON.stringify({ ...journal, entries: journal.entries.slice(0, index) }));
  const sqlite = new BetterSqlite3(':memory:');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: dir });
  return { sqlite, db };
}

describe('migration to several reminder times', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(path.join(os.tmpdir(), 'daylight-migrations-'));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('turns the one time of an existing installation into a list of that time', () => {
    const { sqlite, db } = migratedBefore(dir);
    expect(sqlite.prepare("SELECT count(*) AS n FROM pragma_table_info('settings') WHERE name = 'reminder_times'").get()).toEqual({ n: 0 });
    sqlite.prepare("INSERT INTO settings (id, reminder_enabled, reminder_time) VALUES (1, 1, '21:15')").run();

    migrate(db, { migrationsFolder: FOLDER });
    expect(getSettings(db)).toMatchObject({ reminder_enabled: true, reminder_time: '21:15', reminder_times: ['21:15'] });
  });

  it('gives an installation that never changed the time the default as a list', () => {
    const { sqlite, db } = migratedBefore(dir);
    sqlite.prepare('INSERT INTO settings (id) VALUES (1)').run();
    migrate(db, { migrationsFolder: FOLDER });
    expect(getSettings(db)).toMatchObject({ reminder_time: '20:30', reminder_times: ['20:30'] });
  });
});
