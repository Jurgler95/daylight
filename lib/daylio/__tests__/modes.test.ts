import { createMood, listActivities, listEntryDetails, listMoods } from '@/db/repositories';
import { createTestDb } from '@/db/testDb';

import { applyDaylioImport, previewDaylioImport } from '../apply';
import { parseDaylioCsv } from '../parse';

const HEADER = 'full_date,date,weekday,time,mood,activities,scales,note_title,note';
const csv = (...rows: string[]) => parseDaylioCsv([HEADER, ...rows].join('\n'));

describe('replace import', () => {
  const file = csv('2026-03-02,x,x,20:00,Erschöpft,"Töpfern","","",""', '2026-03-01,x,x,20:00,Gut,"","","","Tag"');

  /** A journal that already knows the custom mood and the activity of the file. */
  function journal() {
    const db = createTestDb();
    createMood(db, { label: 'Erschöpft', level: 1 });
    applyDaylioImport(db, file, { mode: 'merge' });
    return db;
  }

  it('previews against the standard moods, so a custom mood asks for its level again', () => {
    const db = journal();
    expect(previewDaylioImport(db, file).moods.find((mood) => mood.label === 'Erschöpft')).toMatchObject({ needsChoice: false });
    const plan = previewDaylioImport(db, file, {}, 'replace');
    expect(plan.moods.find((mood) => mood.label === 'Erschöpft')).toMatchObject({ existingId: null, needsChoice: true });
    expect(plan.activities.find((activity) => activity.name === 'Töpfern')).toMatchObject({ existingId: null, group: 'Importiert' });
    expect(plan).toMatchObject({ duplicates: 0 });
    expect(plan.entries).toHaveLength(2);
  });

  it('applies the level picked in the replace preview', () => {
    const db = journal();
    const mood = previewDaylioImport(db, file, {}, 'replace').moods.find((m) => m.label === 'Erschöpft')!;
    const outcome = applyDaylioImport(db, file, { mode: 'replace', choices: { moodLevels: { [mood.key]: 1 } } });
    expect(outcome).toMatchObject({ added: 2, duplicates: 0 });
    expect(listMoods(db).find((m) => m.label === 'Erschöpft')?.level).toBe(1);
    expect(listEntryDetails(db).map((entry) => entry.level)).toEqual([4, 1]);
    expect(listActivities(db).map((activity) => activity.name)).toEqual(['Töpfern']);
  });
});

describe('import dedupe', () => {
  it('keeps rows repeated in the file and stays idempotent', () => {
    const db = createTestDb();
    const file = csv('2026-03-01,x,x,20:00,Gut,"","","",""', '2026-03-01,x,x,20:00,Gut,"","","",""');
    expect(applyDaylioImport(db, file, { mode: 'merge' })).toMatchObject({ added: 2, duplicates: 0 });
    expect(applyDaylioImport(db, file, { mode: 'merge' })).toMatchObject({ added: 0, duplicates: 2 });
    expect(listEntryDetails(db)).toHaveLength(2);
  });

  it('tells entries apart by note title and activities', () => {
    const db = createTestDb();
    const file = csv(
      '2026-03-01,x,x,20:00,Gut,"","","Morgen","Text"',
      '2026-03-01,x,x,20:00,Gut,"","","Abend","Text"',
      '2026-03-01,x,x,20:00,Gut,"Arbeit","","Abend","Text"',
    );
    expect(applyDaylioImport(db, file, { mode: 'merge' })).toMatchObject({ added: 3, duplicates: 0 });
    expect(applyDaylioImport(db, file, { mode: 'merge' })).toMatchObject({ added: 0, duplicates: 3 });
  });

  it('imports a row that names a scale twice, with the last value', () => {
    const db = createTestDb();
    const file = csv('2026-03-01,x,x,20:00,Gut,"","Stress: 2 | stress: 3","",""');
    expect(file.warnings).toEqual([{ line: 2, code: 'duplicateScale', value: 'stress' }]);
    expect(applyDaylioImport(db, file, { mode: 'merge' })).toMatchObject({ added: 1 });
    expect(listEntryDetails(db)[0]?.scales.map((scale) => scale.value)).toEqual([3]);
  });
});
