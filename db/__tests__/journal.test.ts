import {
  addPhotos,
  countRows,
  createActivity,
  createEntry,
  createGroup,
  createMood,
  createScale,
  deleteAllData,
  deleteEntry,
  entryIdOnDate,
  firstEntryDate,
  getSettings,
  hasEntryOn,
  listActivities,
  listEntriesOnDates,
  listEntryDetails,
  listGroups,
  listMoods,
  listPlannedActivities,
  photosForEntries,
  setPlannedActivities,
  updateEntry,
  updateGroup,
  updateSettings,
} from '../repositories';
import { entryActivities } from '../schema';
import { createTestDb } from '../testDb';

describe('defaults', () => {
  it('starts with five moods, best first, and the standard groups', () => {
    const db = createTestDb();
    expect(listMoods(db).map((m) => [m.label, m.level])).toEqual([
      ['Super', 5],
      ['Gut', 4],
      ['Ok', 3],
      ['Schlecht', 2],
      ['Lausig', 1],
    ]);
    expect(listGroups(db).map((g) => g.name)).toEqual(['Gefühle', 'Schlaf', 'Wetter', 'Soziales', 'Arbeit', 'Orte und Freizeit']);
    expect(getSettings(db)).toMatchObject({ reminder_time: '20:30', reminder_enabled: false, outlook_enabled: true, first_day_of_week: 1 });
  });

  it('delete all restores the first start', () => {
    const db = createTestDb();
    createMood(db, { label: 'Erschöpft', level: 2 });
    updateSettings(db, { outlook_enabled: false });
    deleteAllData(db);
    expect(countRows(db)).toEqual({ entries: 0, moods: 5, groups: 6, activities: 0, scales: 0, planned: 0, photos: 0 });
    expect(getSettings(db).outlook_enabled).toBe(true);
  });
});

describe('moods, groups, activities', () => {
  it('gives a custom mood the icon of its level and rejects levels outside 1..5', () => {
    const db = createTestDb();
    expect(createMood(db, { label: ' Erschöpft ', level: 2 })).toMatchObject({ label: 'Erschöpft', icon: 'emoticon-sad-outline', sort_order: 5 });
    expect(() => createMood(db, { label: 'Zu gut', level: 6 })).toThrow('level');
    expect(() => createMood(db, { label: '  ', level: 3 })).toThrow('label');
  });

  it('finds groups by folded name instead of duplicating them', () => {
    const db = createTestDb();
    expect(createGroup(db, 'gefuhle').name).toBe('Gefühle');
    expect(createGroup(db, 'Essen')).toMatchObject({ name: 'Essen', sort_order: 6 });
  });

  it('keeps activity names unique per group and orders by group, then position', () => {
    const db = createTestDb();
    const [feelings, sleep] = listGroups(db);
    const good = createActivity(db, { group_id: sleep!.id, name: 'Gut' });
    expect(createActivity(db, { group_id: sleep!.id, name: 'gut' }).id).toBe(good.id);
    createActivity(db, { group_id: feelings!.id, name: 'Gut' });
    createActivity(db, { group_id: feelings!.id, name: 'Müde' });
    updateGroup(db, sleep!.id, { sort_order: -1 });
    expect(listActivities(db).map((a) => `${a.group_id}:${a.name}`)).toEqual([`${sleep!.id}:Gut`, `${feelings!.id}:Gut`, `${feelings!.id}:Müde`]);
    expect(listActivities(db)[0]?.icon).toBe('tag-outline');
  });
});

describe('entries', () => {
  function setup() {
    const db = createTestDb();
    const [feelings] = listGroups(db);
    const tired = createActivity(db, { group_id: feelings!.id, name: 'Müde' });
    const calm = createActivity(db, { group_id: feelings!.id, name: 'Entspannt' });
    const energy = createScale(db, { name: 'Energie', min: 1, max: 5 });
    const good = listMoods(db).find((m) => m.level === 4)!;
    return { db, tired, calm, energy, good };
  }

  it('stores activities and scale values with the entry and reads them back in order', () => {
    const { db, tired, calm, energy, good } = setup();
    createEntry(db, { date: '2026-03-02', time: '20:30', mood_id: good.id, note: '', activity_ids: [tired.id, calm.id, tired.id], scales: [{ scale_id: energy.id, value: 3 }] });
    createEntry(db, { date: '2026-03-01', time: '21:00', mood_id: good.id, note_title: 'Titel', note: 'Text' });
    createEntry(db, { date: '2026-03-02', time: '08:00', mood_id: good.id });
    const details = listEntryDetails(db);
    expect(details.map((e) => `${e.date} ${e.time}`)).toEqual(['2026-03-01 21:00', '2026-03-02 08:00', '2026-03-02 20:30']);
    expect(details[2]).toMatchObject({ level: 4, note: null, activity_ids: [tired.id, calm.id], scales: [{ scale_id: energy.id, value: 3 }] });
    expect(details[0]).toMatchObject({ note_title: 'Titel', note: 'Text', source: 'app', activity_ids: [] });
    expect(firstEntryDate(db)).toBe('2026-03-01');
    expect([hasEntryOn(db, '2026-03-01'), hasEntryOn(db, '2026-03-02'), hasEntryOn(db, '2026-03-03')]).toEqual([true, true, false]);
  });

  it('finds the entry of a day and reads the look back days', () => {
    const { db, good } = setup();
    const late = createEntry(db, { date: '2026-03-02', time: '20:30', mood_id: good.id });
    const early = createEntry(db, { date: '2026-03-02', time: '08:00', mood_id: good.id, note: 'früh' });
    createEntry(db, { date: '2026-03-05', time: '21:00', mood_id: good.id });
    expect(entryIdOnDate(db, '2026-03-02')).toBe(early.id);
    expect(entryIdOnDate(db, '2026-03-02', early.id)).toBe(late.id);
    expect(entryIdOnDate(db, '2026-03-03')).toBeUndefined();
    expect(listEntriesOnDates(db, ['2026-03-05', '2026-03-02', '2026-03-04']).map((e) => [e.date, e.time, e.level, e.note])).toEqual([
      ['2026-03-02', '08:00', 4, 'früh'],
      ['2026-03-02', '20:30', 4, null],
      ['2026-03-05', '21:00', 4, null],
    ]);
    expect(listEntriesOnDates(db, [])).toEqual([]);
  });

  it('replaces the activity list on update and cascades on delete', () => {
    const { db, tired, calm, good } = setup();
    const entry = createEntry(db, { date: '2026-03-02', time: '20:30', mood_id: good.id, activity_ids: [tired.id] });
    updateEntry(db, entry.id, { activity_ids: [calm.id], note: 'neu' });
    expect(listEntryDetails(db)[0]).toMatchObject({ note: 'neu', activity_ids: [calm.id] });
    updateEntry(db, entry.id, { time: '21:15' });
    expect(listEntryDetails(db)[0]).toMatchObject({ time: '21:15', activity_ids: [calm.id] });
    deleteEntry(db, entry.id);
    expect(db.select().from(entryActivities).all()).toEqual([]);
  });

  it('keeps photos in order, replaces them on save and hands their names back on delete', () => {
    const { db, good } = setup();
    const entry = createEntry(db, { date: '2026-03-02', time: '20:30', mood_id: good.id, photos: ['b.jpg', 'a.jpg'] });
    expect(listEntryDetails(db)[0]?.photos).toEqual(['b.jpg', 'a.jpg']);
    updateEntry(db, entry.id, { note: 'ohne Fotoliste' });
    expect(listEntryDetails(db)[0]?.photos).toEqual(['b.jpg', 'a.jpg']);
    updateEntry(db, entry.id, { photos: ['a.jpg'] });
    expect(listEntryDetails(db)[0]?.photos).toEqual(['a.jpg']);
    expect(addPhotos(db, entry.id, ['a.jpg', 'c.jpg'])).toEqual(['c.jpg']);
    expect(deleteEntry(db, entry.id)).toEqual(['a.jpg', 'c.jpg']);
    expect(countRows(db).photos).toBe(0);
  });

  it('reads the photos of chosen entries only, in order', () => {
    const { db, good } = setup();
    const first = createEntry(db, { date: '2026-03-02', time: '20:30', mood_id: good.id, photos: ['b.jpg', 'a.jpg'] });
    const second = createEntry(db, { date: '2026-03-03', time: '20:30', mood_id: good.id });
    createEntry(db, { date: '2026-03-04', time: '20:30', mood_id: good.id, photos: ['c.jpg'] });
    expect([...photosForEntries(db, [first.id, second.id])]).toEqual([[first.id, ['b.jpg', 'a.jpg']]]);
    expect(photosForEntries(db, []).size).toBe(0);
  });

  it('rejects malformed days and times', () => {
    const { db, good } = setup();
    expect(() => createEntry(db, { date: '2026-02-30', time: '20:00', mood_id: good.id })).toThrow('YYYY-MM-DD');
    expect(() => createEntry(db, { date: '2026-02-03', time: '8:00', mood_id: good.id })).toThrow('HH:mm');
    expect(() => createEntry(db, { date: '2026-02-03', time: '20:00', mood_id: 999 })).toThrow();
  });
});

describe('plans and settings', () => {
  it('replaces the plan of a day', () => {
    const db = createTestDb();
    const work = createActivity(db, { group_id: listGroups(db)[4]!.id, name: 'Arbeit' });
    const holiday = createActivity(db, { group_id: listGroups(db)[4]!.id, name: 'Urlaub' });
    setPlannedActivities(db, '2026-10-01', [work.id, work.id]);
    setPlannedActivities(db, '2026-10-02', [work.id]);
    setPlannedActivities(db, '2026-10-01', [holiday.id]);
    expect(listPlannedActivities(db, '2026-10-01', '2026-10-01')).toEqual([{ date: '2026-10-01', activity_id: holiday.id }]);
    expect(listPlannedActivities(db)).toHaveLength(2);
  });

  it('validates settings', () => {
    const db = createTestDb();
    expect(() => updateSettings(db, { reminder_time: '25:00' })).toThrow();
    expect(() => updateSettings(db, { first_day_of_week: 7 })).toThrow();
    expect(updateSettings(db, { reminder_time: '21:00' }).reminder_time).toBe('21:00');
  });
});
