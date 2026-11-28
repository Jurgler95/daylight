import { countRows, createActivity, createEntry, createGroup, createMood, createScale, listActivities, listEntryDetails, listGroups, listMoods, listScales } from '@/db/repositories';
import { tidyStandards } from '@/db/repositories/standards';
import { createTestDb } from '@/db/testDb';
import { applyLanguage } from '@/lib/i18n';

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

describe('JSON merge across languages', () => {
  afterEach(() => applyLanguage('de'));

  /** A German journal: two entries, a standard and a custom mood, a sleep activity and one of the user's own. */
  function germanJournal() {
    const db = createTestDb();
    const sleep = listGroups(db).find((group) => group.name === 'Schlaf')!;
    const gut = createActivity(db, { group_id: sleep.id, name: 'Gut' });
    const hobbies = createGroup(db, 'Hobbys');
    const yoga = createActivity(db, { group_id: hobbies.id, name: 'Yoga' });
    const good = listMoods(db).find((mood) => mood.level === 4)!;
    const tired = createMood(db, { label: 'Erschöpft', level: 2 });
    createEntry(db, { date: '2026-03-01', time: '20:00', mood_id: good.id, activity_ids: [gut.id, yoga.id] });
    createEntry(db, { date: '2026-03-02', time: '20:00', mood_id: tired.id });
    return db;
  }

  /** An English journal with one entry of its own. */
  function englishJournal() {
    applyLanguage('en');
    const db = createTestDb();
    tidyStandards(db, 'en');
    const sleep = listGroups(db).find((group) => group.name === 'Sleep')!;
    createActivity(db, { group_id: sleep.id, name: 'Good sleep' });
    createEntry(db, { date: '2026-03-03', time: '20:00', mood_id: listMoods(db)[0]!.id });
    return db;
  }

  it('lands the standard moods, groups and activities of a German backup on the English ones', () => {
    const payload = parseImport(JSON.stringify(buildExport(germanJournal(), '1')));
    const target = englishJournal();
    expect(previewImport(target, payload).created).toEqual({ moods: ['Erschöpft'], groups: ['Hobbys'], activities: ['Yoga'] });

    applyImport(target, payload, 'merge');
    expect(listMoods(target).map((mood) => mood.label)).toEqual(['Great', 'Good', 'Okay', 'Bad', 'Awful', 'Erschöpft']);
    expect(listGroups(target).map((group) => group.name)).toEqual(['Emotions', 'Sleep', 'Weather', 'Social', 'Work', 'Places and hobbies', 'Hobbys']);
    expect(listActivities(target).map((activity) => activity.name)).toEqual(['Good sleep', 'Yoga']);
    const first = listEntryDetails(target).find((entry) => entry.date === '2026-03-01')!;
    expect(first.level).toBe(4);
    expect(first.activity_ids).toHaveLength(2);

    // The same backup again finds every entry, though its names are German and these English.
    expect(applyImport(target, payload, 'merge')).toEqual({ added: 0, duplicates: 2 });
    expect(listMoods(target)).toHaveLength(6);
  });

  it('names a replaced journal in the app language', () => {
    const payload = parseImport(JSON.stringify(buildExport(germanJournal(), '1')));
    const target = englishJournal();
    applyImport(target, payload, 'replace');
    expect(listMoods(target).map((mood) => mood.label)).toEqual(['Great', 'Good', 'Okay', 'Bad', 'Awful', 'Erschöpft']);
    expect(listActivities(target).map((activity) => activity.name)).toEqual(['Good sleep', 'Yoga']);
  });
});
