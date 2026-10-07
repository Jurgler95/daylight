import { applyImport, buildExport, parseImport } from '@/lib/export';

import {
  createEntry,
  createTurningPoint,
  deleteAllData,
  deleteEntry,
  deleteTurningPoint,
  listEntryDetails,
  listMoods,
  listTurningPoints,
  TurningPointLimitError,
  turningPointLostBy,
  updateEntry,
  updateTurningPoint,
} from '../repositories';
import { createTestDb } from '../testDb';

function dbWithDays(dates: readonly string[]) {
  const db = createTestDb();
  const mood = listMoods(db)[0]!.id;
  for (const date of dates) createEntry(db, { date, time: '20:00', mood_id: mood, activity_ids: [] });
  return db;
}

const DAYS_2025 = ['2025-01-10', '2025-03-01', '2025-05-20', '2025-08-08', '2025-11-11'];

describe('turning points', () => {
  it('needs a day with an entry', () => {
    const db = dbWithDays(['2026-01-01']);
    expect(() => createTurningPoint(db, { date: '2026-01-02', title: 'Umzug' })).toThrow('has no entry');
    expect(createTurningPoint(db, { date: '2026-01-01', title: ' Umzug ', note: '  ' })).toMatchObject({ date: '2026-01-01', title: 'Umzug', note: null });
  });

  it('allows one per day and four per calendar year of their date', () => {
    const db = dbWithDays([...DAYS_2025, '2026-01-01']);
    for (const date of DAYS_2025.slice(0, 4)) createTurningPoint(db, { date, title: date });
    expect(() => createTurningPoint(db, { date: '2025-01-10', title: 'again' })).toThrow('already');
    expect(() => createTurningPoint(db, { date: '2025-11-11', title: 'fifth' })).toThrow(TurningPointLimitError);
    // A new year has room again.
    expect(createTurningPoint(db, { date: '2026-01-01', title: 'Neues Jahr' }).date).toBe('2026-01-01');
    // Deleting one frees its place.
    deleteTurningPoint(db, listTurningPoints(db)[0]!.id);
    expect(createTurningPoint(db, { date: '2025-11-11', title: 'fifth' }).date).toBe('2025-11-11');
  });

  it('edits title and note, never the date', () => {
    const db = dbWithDays(['2026-02-02']);
    const point = createTurningPoint(db, { date: '2026-02-02', title: 'Neuer Job' });
    expect(updateTurningPoint(db, point.id, { title: 'Neue Stelle', note: 'endlich' })).toMatchObject({ date: '2026-02-02', title: 'Neue Stelle', note: 'endlich' });
    expect(() => updateTurningPoint(db, point.id, { title: ' ' })).toThrow();
  });

  it('go with the last entry of their day, deleted or moved away, and the editor can ask first', () => {
    const db = dbWithDays(['2026-02-02', '2026-02-02', '2026-03-03', '2026-04-04']);
    const [first, second, march] = listEntryDetails(db).sort((a, b) => a.id - b.id);
    createTurningPoint(db, { date: '2026-02-02', title: 'Zwei Einträge' });
    createTurningPoint(db, { date: '2026-03-03', title: 'Umzug' });

    expect(turningPointLostBy(db, first!.id)).toBeUndefined();
    deleteEntry(db, first!.id);
    expect(listTurningPoints(db)).toHaveLength(2);
    expect(turningPointLostBy(db, second!.id)?.title).toBe('Zwei Einträge');
    deleteEntry(db, second!.id);
    expect(listTurningPoints(db).map((point) => point.title)).toEqual(['Umzug']);

    expect(turningPointLostBy(db, march!.id, '2026-03-03')).toBeUndefined();
    expect(turningPointLostBy(db, march!.id, '2026-03-05')?.title).toBe('Umzug');
    updateEntry(db, march!.id, { date: '2026-03-05' });
    expect(listTurningPoints(db)).toEqual([]);
  });

  it('go with all other data', () => {
    const db = dbWithDays(['2026-02-02']);
    createTurningPoint(db, { date: '2026-02-02', title: 'Neuer Job' });
    deleteAllData(db);
    expect(listTurningPoints(db)).toEqual([]);
  });
});

describe('turning points in the backup', () => {
  it('survive a replace and are left out of a backup without them', () => {
    const db = dbWithDays(['2026-02-02']);
    createTurningPoint(db, { date: '2026-02-02', title: 'Neuer Job', note: 'Tag eins' });
    const payload = buildExport(db, '1.0.0', 'X');
    expect(payload.turning_points).toEqual([expect.objectContaining({ date: '2026-02-02', title: 'Neuer Job', note: 'Tag eins' })]);

    const target = createTestDb();
    applyImport(target, parseImport(JSON.stringify(payload)), 'replace');
    expect(buildExport(target, '1.0.0', 'X')).toEqual(payload);

    const old: Partial<typeof payload> = { ...payload };
    delete old.turning_points;
    applyImport(target, parseImport(JSON.stringify(old)), 'replace');
    expect(listTurningPoints(target)).toEqual([]);
  });

  it('merge without doubling a day or passing the cap of a year', () => {
    const source = dbWithDays(DAYS_2025);
    for (const date of DAYS_2025.slice(1)) createTurningPoint(source, { date, title: `from ${date}` });
    const target = dbWithDays(DAYS_2025);
    createTurningPoint(target, { date: '2025-01-10', title: 'here' });
    createTurningPoint(target, { date: '2025-03-01', title: 'here too' });

    applyImport(target, parseImport(JSON.stringify(buildExport(source, '1.0.0', 'X'))), 'merge');
    expect(listTurningPoints(target).map((point) => [point.date, point.title])).toEqual([
      ['2025-01-10', 'here'],
      ['2025-03-01', 'here too'],
      ['2025-05-20', 'from 2025-05-20'],
      ['2025-08-08', 'from 2025-08-08'],
    ]);
  });

  it('rejects a file with more than four in a year', () => {
    const db = dbWithDays(DAYS_2025);
    for (const date of DAYS_2025.slice(0, 4)) createTurningPoint(db, { date, title: date });
    const payload = buildExport(db, '1.0.0', 'X');
    payload.turning_points!.push({ ...payload.turning_points![0]!, date: '2025-11-11' });
    expect(() => parseImport(JSON.stringify(payload))).toThrow('zu viele Wendepunkte');
  });

  it('restores a backup with a turning point left on a day without an entry, without that turning point', () => {
    const db = dbWithDays(['2026-02-02', '2026-03-03']);
    createTurningPoint(db, { date: '2026-02-02', title: 'Neuer Job' });
    createTurningPoint(db, { date: '2026-03-03', title: 'Umzug' });
    const payload = buildExport(db, '1.0.0', 'X');
    payload.turning_points![0]!.date = '2026-02-03';
    for (const mode of ['replace', 'merge'] as const) {
      const target = createTestDb();
      applyImport(target, parseImport(JSON.stringify(payload)), mode);
      expect(listTurningPoints(target).map((point) => point.title)).toEqual(['Umzug']);
    }
  });
});
