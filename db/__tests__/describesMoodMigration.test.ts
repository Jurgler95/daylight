import BetterSqlite3 from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { feelingsGroupNames } from '@/lib/catalog/catalog';
import { LANGUAGES } from '@/lib/i18n/language';

import { ensureDefaults } from '../repositories/defaults';
import { listGroups } from '../repositories/groups';
import { deleteAllData } from '../repositories/maintenance';
import { listScales } from '../repositories/scales';
import * as schema from '../schema';
import { createTestDb } from '../testDb';

/**
 * The update from a version without the mark "describes the mood": the database is first migrated
 * up to the step before it (a copy of the migrations folder with a shortened journal), gets groups
 * and a scale as that version wrote them, and is then migrated with the real folder.
 */
const FOLDER = path.join(__dirname, '..', '..', 'drizzle');
const TAG = '0018_third_boomer';

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

describe('migration to the mark "describes the mood"', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(path.join(os.tmpdir(), 'daylight-migrations-'));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('marks the feelings group of an existing installation by its exact name, in every language', () => {
    const { sqlite, db } = migratedBefore(dir);
    expect(sqlite.prepare("SELECT count(*) AS n FROM pragma_table_info('activity_groups') WHERE name = 'describes_mood'").get()).toEqual({ n: 0 });
    const insert = sqlite.prepare('INSERT INTO activity_groups (name, sort_order) VALUES (?, ?)');
    const names = [...feelingsGroupNames(), 'Schlaf', 'Meine Gefühle', 'gefühle', 'Feelings'];
    names.forEach((name, index) => insert.run(name, index));
    sqlite.prepare("INSERT INTO scales (name, min, max) VALUES ('Energie', 1, 5)").run();

    migrate(db, { migrationsFolder: FOLDER });
    const groups = listGroups(db);
    expect(groups.filter((group) => group.describes_mood).map((group) => group.name)).toEqual(feelingsGroupNames());
    // A renamed group, another spelling and every other group stay unmarked, and so does every scale.
    expect(groups.filter((group) => !group.describes_mood).map((group) => group.name)).toEqual(['Schlaf', 'Meine Gefühle', 'gefühle', 'Feelings']);
    expect(listScales(db).map((scale) => scale.describes_mood)).toEqual([false]);
  });

  it('lists in SQL exactly the names the app knows for its feelings group', () => {
    const sql = readFileSync(path.join(FOLDER, `${TAG}.sql`), 'utf8');
    const list = /WHERE `name` IN \(([^)]*)\)/.exec(sql)?.[1] ?? '';
    const names = [...list.matchAll(/'([^']*)'/g)].map((match) => match[1]!);
    expect([...names].sort()).toEqual(feelingsGroupNames().sort());
    expect(names).toHaveLength(LANGUAGES.length);
  });
});

describe('the mark on a fresh start', () => {
  it.each(LANGUAGES)('marks only the feelings group in %s', (language) => {
    const sqlite = new BetterSqlite3(':memory:');
    const db = drizzle(sqlite, { schema });
    migrate(db, { migrationsFolder: FOLDER });
    ensureDefaults(db, language);
    const groups = listGroups(db);
    expect(groups.map((group) => group.describes_mood)).toEqual([true, false, false, false, false, false]);
    expect(feelingsGroupNames()).toContain(groups[0]!.name);
  });

  it('comes back after deleting all data', () => {
    const db = createTestDb();
    deleteAllData(db);
    expect(listGroups(db).filter((group) => group.describes_mood).map((group) => group.name)).toEqual(['Gefühle']);
  });
});
