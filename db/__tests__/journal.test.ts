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
  settleReminderPrompt,
  photosForEntries,
  setPlannedActivities,
  updateEntry,
  updateGroup,
  updateSettings,
} from '../repositories';
import { ensureDefaults } from '../repositories/defaults';
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
      ['Mies', 1],
    ]);
    expect(listGroups(db).map((g) => g.name)).toEqual(['Gefühle', 'Schlaf', 'Wetter', 'Soziales', 'Arbeit', 'Orte und Freizeit']);
    expect(getSettings(db)).toMatchObject({ reminder_time: '20:30', reminder_enabled: false, outlook_enabled: true, first_day_of_week: 1 });
  });

  it('names the defaults in English for an English first start', () => {
    const db = createTestDb();
    updateSettings(db, { language: 'en' });
    deleteAllData(db, 'en');
    expect(getSettings(db).language).toBe('en');
    expect(listMoods(db).map((m) => m.label)).toEqual(['Great', 'Good', 'Okay', 'Bad', 'Awful']);
    expect(listGroups(db).map((g) => g.name)).toEqual(['Emotions', 'Sleep', 'Weather', 'Social', 'Work', 'Places and hobbies']);
  });

  it('fills each standard group with a few starter activities in the chosen language', () => {
    const db = createTestDb();
    const byGroup = (lang: 'de' | 'en') => {
      deleteAllData(db, lang);
      const groups = listGroups(db);
      return Object.fromEntries(groups.map((g) => [g.name, listActivities(db).filter((a) => a.group_id === g.id).map((a) => a.name)]));
    };
    expect(byGroup('de')).toEqual({
      Gefühle: ['Glücklich', 'Entspannt', 'Müde', 'Gestresst', 'Traurig'],
      Schlaf: ['Gut', 'Mäßig', 'Schlecht'],
      Wetter: ['Sonnig', 'Wolkig', 'Regnerisch', 'Schnee'],
      Soziales: ['Familie', 'Freunde', 'Date', 'Party'],
      Arbeit: ['Arbeit', 'HomeOffice', 'Überstunden', 'Urlaub'],
      'Orte und Freizeit': ['Sport', 'Lesen', 'Natur', 'Filme', 'Einkaufen'],
    });
    expect(byGroup('en')).toEqual({
      Emotions: ['Happy', 'Relaxed', 'Tired', 'Stressed', 'Sad'],
      Sleep: ['Good sleep', 'Medium sleep', 'Bad sleep'],
      Weather: ['Sunny', 'Cloudy', 'Rainy', 'Snow'],
      Social: ['Family', 'Friends', 'Date', 'Party'],
      Work: ['Work', 'Work from home', 'Overtime', 'Vacation'],
      'Places and hobbies': ['Sport', 'Reading', 'Nature', 'Movies', 'Shopping'],
    });
    expect(listActivities(db).every((a) => a.icon !== 'tag-outline')).toBe(true);
  });

  it('does not refill an emptied group on the next start', () => {
    const db = createTestDb();
    ensureDefaults(db);
    expect(countRows(db).activities).toBe(0);
  });

  it('delete all restores the first start', () => {
    const db = createTestDb();
    createMood(db, { label: 'Erschöpft', level: 2 });
    updateSettings(db, { outlook_enabled: false });
    deleteAllData(db);
    expect(countRows(db)).toEqual({ entries: 0, moods: 5, groups: 6, activities: 25, scales: 0, planned: 0, photos: 0 });
    expect(getSettings(db).outlook_enabled).toBe(true);
  });

  it('starts the reminder and streak settings like a new install, also after delete all', () => {
    const db = createTestDb();
    const fresh = { reminder_yesterday_enabled: true, reminder_yesterday_time: '10:00', reminder_prompt_done: false, streak_celebrated: null, streak_rescue_dismissed: null };
    expect(getSettings(db)).toMatchObject(fresh);
    updateSettings(db, { reminder_yesterday_enabled: false, reminder_yesterday_time: '09:15', reminder_prompt_done: true, streak_celebrated: '{"start":"2026-09-01","days":10}', streak_rescue_dismissed: '2026-09-20' });
    deleteAllData(db);
    expect(getSettings(db)).toMatchObject(fresh);
    expect(() => updateSettings(db, { reminder_yesterday_time: '9:15' })).toThrow('reminder_yesterday_time');
    expect(() => updateSettings(db, { streak_rescue_dismissed: '20.09.2026' })).toThrow('streak_rescue_dismissed');
  });

  it('counts the reminder sheet as answered for whoever already has the reminder on', () => {
    const db = createTestDb();
    expect(settleReminderPrompt(db).reminder_prompt_done).toBe(false);
    updateSettings(db, { reminder_enabled: true });
    expect(settleReminderPrompt(db).reminder_prompt_done).toBe(true);
    // Switching the reminder off later does not bring the sheet back.
    updateSettings(db, { reminder_enabled: false });
    expect(settleReminderPrompt(db).reminder_prompt_done).toBe(true);
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

  it('reads the links of a date range the same as the whole journal does', () => {
    const { db, tired, calm, energy, good } = setup();
    createEntry(db, { date: '2026-03-01', time: '20:00', mood_id: good.id, activity_ids: [tired.id], scales: [{ scale_id: energy.id, value: 1 }], photos: ['a.jpg'] });
    createEntry(db, { date: '2026-03-02', time: '08:00', mood_id: good.id, activity_ids: [calm.id], photos: ['b.jpg'] });
    createEntry(db, { date: '2026-03-02', time: '20:00', mood_id: good.id, scales: [{ scale_id: energy.id, value: 4 }] });
    createEntry(db, { date: '2026-03-03', time: '20:00', mood_id: good.id, activity_ids: [tired.id, calm.id], photos: ['c.jpg'] });
    const all = listEntryDetails(db);
    expect(listEntryDetails(db, '2026-03-02', '2026-03-02')).toEqual(all.filter((e) => e.date === '2026-03-02'));
    expect(listEntryDetails(db, '2026-03-02', '2026-03-02').map((e) => [e.activity_ids, e.scales, e.photos])).toEqual([
      [[calm.id], [], ['b.jpg']],
      [[], [{ scale_id: energy.id, value: 4 }], []],
    ]);
    expect(listEntryDetails(db, '2026-03-03')).toEqual(all.slice(3));
    expect(listEntryDetails(db, undefined, '2026-03-01')).toEqual(all.slice(0, 1));
    expect(listEntryDetails(db, '2026-04-01', '2026-04-30')).toEqual([]);
  });

  it('keeps the last value when a scale is given twice', () => {
    const { db, energy, good } = setup();
    const entry = createEntry(db, {
      date: '2026-03-02',
      time: '20:30',
      mood_id: good.id,
      scales: [
        { scale_id: energy.id, value: 2 },
        { scale_id: energy.id, value: 3 },
      ],
    });
    expect(listEntryDetails(db)[0]?.scales).toEqual([{ scale_id: energy.id, value: 3 }]);
    updateEntry(db, entry.id, { scales: [{ scale_id: energy.id, value: 5 }, { scale_id: energy.id, value: 1 }] });
    expect(listEntryDetails(db)[0]?.scales).toEqual([{ scale_id: energy.id, value: 1 }]);
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
