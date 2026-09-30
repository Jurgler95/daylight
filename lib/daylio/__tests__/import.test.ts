import { readFileSync } from 'node:fs';
import path from 'node:path';

import { listActivities, listGroups, listMoods } from '@/db/repositories';
import { countRows } from '@/db/repositories/maintenance';
import { createTestDb } from '@/db/testDb';

import { applyDaylioImport, ImportHasErrorsError, previewDaylioImport } from '../apply';
import { parseDaylioCsv } from '../parse';
import { readDaylioRows } from '../rows';

const sample = parseDaylioCsv(readFileSync(path.join(__dirname, 'fixtures', 'sample.csv'), 'utf8'));
const HEADER = 'full_date,date,weekday,time,mood,activities,scales,note_title,note';

/** 20 synthetic rows, the one on line 17 broken. */
function fileWithErrorOnLine17(): string {
  const rows = Array.from({ length: 20 }, (_, i) => {
    const day = String(20 - i).padStart(2, '0');
    const time = i + 2 === 17 ? '25:99' : '20:30';
    return `2026-01-${day},x,x,${time},Gut,"Arbeit | Sonnig","","","Tag ${day}"`;
  });
  return [HEADER, ...rows].join('\n');
}

describe('Daylio import', () => {
  it('previews the sample against a fresh database', () => {
    const plan = previewDaylioImport(createTestDb(), sample);
    expect(plan.entryCount).toBe(6);
    expect(plan.moods).toHaveLength(5);
    expect(plan.moods.filter((m) => m.existingId === null)).toHaveLength(1);
    expect(plan.activities).toHaveLength(18);
    expect(plan.activities.every((a) => a.existingId === null)).toBe(true);
    expect(plan.entries).toHaveLength(6);
    expect(plan.duplicates).toBe(0);
  });

  it('imports moods, groups, activities and entries', () => {
    const db = createTestDb();
    const outcome = applyDaylioImport(db, sample, { mode: 'merge', choices: { moodLevels: { 'geht so': 2 } } });
    expect(outcome).toEqual({ added: 6, duplicates: 0, skipped: 0, photos: 0 });
    expect(countRows(db)).toMatchObject({ entries: 6, moods: 6, activities: 18 });
    expect(listMoods(db).find((m) => m.label === 'Geht so')).toMatchObject({ level: 2, icon: 'emoticon-sad-outline' });
    const groups = listGroups(db).map((g) => g.name);
    expect(groups[groups.length - 1]).toBe('Importiert');
    const topfern = listActivities(db).find((a) => a.name === 'Töpfern');
    expect(listGroups(db).find((g) => g.id === topfern?.group_id)?.name).toBe('Importiert');
    // "Gut" and "Schlecht" are sleep activities here, never confused with the moods of the same name.
    // Their order follows the file: "Gut" comes after "Entspannt", which only appears in the last row.
    const sleep = listGroups(db).find((g) => g.name === 'Schlaf');
    expect(listActivities(db).filter((a) => a.group_id === sleep?.id).map((a) => a.name)).toEqual(['Mäßig', 'Schlecht', 'Gut']);
  });

  it('never creates duplicates when the same file is imported twice', () => {
    const db = createTestDb();
    applyDaylioImport(db, sample, { mode: 'merge' });
    const before = countRows(db);
    expect(previewDaylioImport(db, sample)).toMatchObject({ duplicates: 6, entries: [] });
    expect(applyDaylioImport(db, sample, { mode: 'merge' })).toEqual({ added: 0, duplicates: 6, skipped: 0, photos: 0 });
    expect(countRows(db)).toEqual(before);
  });

  it('leaves the database untouched when line 17 is broken and skipping was not confirmed', () => {
    const db = createTestDb();
    applyDaylioImport(db, sample, { mode: 'merge' });
    const before = countRows(db);
    const parsed = parseDaylioCsv(fileWithErrorOnLine17());
    expect(parsed.errors).toEqual([{ line: 17, code: 'time', value: '25:99' }]);
    expect(() => applyDaylioImport(db, parsed, { mode: 'merge' })).toThrow(ImportHasErrorsError);
    expect(() => applyDaylioImport(db, parsed, { mode: 'replace' })).toThrow(ImportHasErrorsError);
    expect(countRows(db)).toEqual(before);

    expect(applyDaylioImport(db, parsed, { mode: 'merge', skipErrors: true })).toEqual({ added: 19, duplicates: 0, skipped: 1, photos: 0 });
  });

  it('rolls everything back when writing fails half way', () => {
    const db = createTestDb();
    const before = countRows(db);
    // An impossible level makes creating the mood throw after groups and other rows were written.
    expect(() => applyDaylioImport(db, sample, { mode: 'merge', choices: { moodLevels: { 'geht so': 9 as never } } })).toThrow();
    expect(countRows(db)).toEqual(before);
  });

  it('replace clears the journal and imports into a fresh start', () => {
    const db = createTestDb();
    applyDaylioImport(db, parseDaylioCsv(fileWithErrorOnLine17()), { mode: 'merge', skipErrors: true });
    applyDaylioImport(db, sample, { mode: 'replace' });
    expect(countRows(db)).toMatchObject({ entries: 6, activities: 18, moods: 6 });
  });

  it('reads entries back as Daylio rows with activities in group order', () => {
    const db = createTestDb();
    applyDaylioImport(db, sample, { mode: 'merge' });
    const row = readDaylioRows(db).find((r) => r.date === '2026-03-10');
    expect(row).toMatchObject({ mood: 'Super', time: '21:05' });
    expect(row?.activities).toEqual(['Glücklich', 'Gut', 'Sonnig', 'Familie', 'zu Hause']);
  });
});
