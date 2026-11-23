import { countRows, createEntry, createScale, listEntryDetails, listMoods, listScales } from '@/db/repositories';
import { createTestDb } from '@/db/testDb';

import { applyImport, buildExport, parseImport, previewImport } from '../index';

describe('JSON merge dedupe', () => {
  /** Entries that share date, time, mood and note: two only differ in the title, two are the same. */
  function journal() {
    const db = createTestDb();
    const good = listMoods(db).find((mood) => mood.level === 4)!;
    const entry = { date: '2026-03-01', time: '20:00', mood_id: good.id, note: 'Text' };
    createEntry(db, { ...entry, note_title: 'Morgen' });
    createEntry(db, { ...entry, note_title: 'Abend' });
    createEntry(db, entry);
    createEntry(db, entry);
    return db;
  }

  it('restores a backup into an empty journal completely', () => {
    const payload = parseImport(JSON.stringify(buildExport(journal(), '1')));
    const target = createTestDb();
    expect(previewImport(target, payload)).toMatchObject({ toAdd: 4, duplicates: 0 });
    expect(applyImport(target, payload, 'merge')).toEqual({ added: 4, duplicates: 0 });
    expect(countRows(target).entries).toBe(4);
  });

  it('adds nothing when the same backup is merged again', () => {
    const db = journal();
    const payload = parseImport(JSON.stringify(buildExport(db, '1')));
    expect(applyImport(db, payload, 'merge')).toEqual({ added: 0, duplicates: 4 });
    expect(countRows(db).entries).toBe(4);
  });
});

describe('JSON merge of scales', () => {
  it('keeps a duration apart from a rating of the same name', () => {
    const source = createTestDb();
    const work = createScale(source, { name: 'Arbeit', kind: 'duration' });
    const mood = listMoods(source)[0]!;
    createEntry(source, { date: '2026-03-02', time: '20:00', mood_id: mood.id, scales: [{ scale_id: work.id, value: 510 }] });
    const target = createTestDb();
    createScale(target, { name: 'arbeit', min: 1, max: 5 });
    applyImport(target, parseImport(JSON.stringify(buildExport(source, '1'))), 'merge');
    const duration = listScales(target).find((scale) => scale.kind === 'duration');
    expect(duration).toMatchObject({ name: 'Arbeit', max: 1440 });
    expect(listEntryDetails(target)[0]?.scales).toEqual([{ scale_id: duration?.id, value: 510 }]);
  });
});
