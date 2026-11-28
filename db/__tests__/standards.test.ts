import { createActivity, createEntry, createGroup, createMood, listActivities, listEntryDetails, listGroups, listMoods, setPlannedActivities, updateMood } from '@/db/repositories';
import { listPlannedActivities } from '@/db/repositories/plans';
import { tidyStandards } from '@/db/repositories/standards';
import { createTestDb } from '@/db/testDb';
import { activities, moods } from '@/db/schema';
import type { Database } from '@/db/types';

const labels = (db: Database) => listMoods(db, { includeArchived: true }).map((mood) => `${mood.level}:${mood.label}`);
const groupNames = (db: Database) => listGroups(db, { includeArchived: true }).map((group) => group.name);

describe('tidyStandards', () => {
  it('renames the standard moods, groups and activities to the new language and leaves renamed ones alone', () => {
    const db = createTestDb();
    const good = listMoods(db).find((mood) => mood.level === 4)!;
    updateMood(db, good.id, { label: 'Prima' });
    const sleep = listGroups(db).find((group) => group.name === 'Schlaf')!;
    createActivity(db, { group_id: sleep.id, name: 'Gut' });
    createActivity(db, { group_id: sleep.id, name: 'Mittagsschlaf' });
    createGroup(db, 'Hobbys');

    tidyStandards(db, 'en');
    expect(labels(db)).toEqual(['5:Great', '4:Prima', '3:Okay', '2:Bad', '1:Awful']);
    expect(groupNames(db)).toEqual(['Emotions', 'Sleep', 'Weather', 'Social', 'Work', 'Places and hobbies', 'Hobbys']);
    expect(listActivities(db).map((activity) => activity.name)).toEqual(['Good sleep', 'Mittagsschlaf']);

    tidyStandards(db, 'pl');
    expect(labels(db)[0]).toBe('5:Świetnie');
    tidyStandards(db, 'de');
    expect(labels(db)).toEqual(['5:Super', '4:Prima', '3:Ok', '2:Schlecht', '1:Mies']);
    expect(groupNames(db)[1]).toBe('Schlaf');
  });

  it('folds the standard moods a backup in another language doubled into one per level', () => {
    const db = createTestDb();
    const german = listMoods(db);
    // What a merge of an English backup left before: five more moods, one entry on "Good".
    const english = ['Great', 'Good', 'Okay', 'Bad', 'Awful'].map((label, index) => createMood(db, { label, level: 5 - index }));
    const custom = createMood(db, { label: 'Erschöpft', level: 2 });
    const entry = createEntry(db, { date: '2026-03-01', time: '20:00', mood_id: english[1]!.id });
    createEntry(db, { date: '2026-03-02', time: '20:00', mood_id: custom.id });

    tidyStandards(db, 'de');
    expect(listMoods(db).map((mood) => mood.id)).toEqual([...german.map((mood) => mood.id), custom.id]);
    expect(labels(db)).toEqual(['5:Super', '4:Gut', '3:Ok', '2:Schlecht', '1:Mies', '2:Erschöpft']);
    expect(listEntryDetails(db).find((row) => row.id === entry.id)?.mood_id).toBe(german[1]!.id);

    // Idempotent.
    tidyStandards(db, 'de');
    expect(labels(db)).toEqual(['5:Super', '4:Gut', '3:Ok', '2:Schlecht', '1:Mies', '2:Erschöpft']);
  });

  it('keeps the active one of two standard moods of a level, in the app language once renamed', () => {
    const db = createTestDb();
    const gut = listMoods(db).find((mood) => mood.level === 4)!;
    updateMood(db, gut.id, { archived: true });
    const good = createMood(db, { label: 'Good', level: 4 });
    tidyStandards(db, 'de');
    const level4 = listMoods(db, { includeArchived: true }).filter((mood) => mood.level === 4);
    expect(level4).toEqual([expect.objectContaining({ id: good.id, label: 'Gut', archived: false })]);
  });

  it('merges doubled standard groups and activities, moving entries, plans and the user’s own activities', () => {
    const db = createTestDb();
    const mood = listMoods(db)[0]!;
    const schlaf = listGroups(db).find((group) => group.name === 'Schlaf')!;
    const gut = createActivity(db, { group_id: schlaf.id, name: 'Gut' });
    const sleep = createGroup(db, 'Sleep');
    const good = createActivity(db, { group_id: sleep.id, name: 'Good sleep' });
    const nap = createActivity(db, { group_id: sleep.id, name: 'Nap' });
    const both = createEntry(db, { date: '2026-03-01', time: '20:00', mood_id: mood.id, activity_ids: [gut.id, good.id] });
    const english = createEntry(db, { date: '2026-03-02', time: '20:00', mood_id: mood.id, activity_ids: [good.id, nap.id] });
    setPlannedActivities(db, '2026-04-01', [good.id]);

    tidyStandards(db, 'de');
    expect(groupNames(db).filter((name) => name === 'Schlaf' || name === 'Sleep')).toEqual(['Schlaf']);
    const inSleep = listActivities(db).filter((activity) => activity.group_id === schlaf.id);
    expect(inSleep.map((activity) => activity.name)).toEqual(['Gut', 'Nap']);
    const details = new Map(listEntryDetails(db).map((row) => [row.id, row.activity_ids.sort()]));
    expect(details.get(both.id)).toEqual([gut.id]);
    expect(details.get(english.id)).toEqual([gut.id, nap.id].sort());
    expect(listPlannedActivities(db)).toEqual([{ date: '2026-04-01', activity_id: gut.id }]);
    expect(db.select().from(activities).all()).toHaveLength(2);
  });

  it('never renames an activity onto one of the user’s own and ignores activities outside standard groups', () => {
    const db = createTestDb();
    const own = createGroup(db, 'Mein Schlaf');
    createActivity(db, { group_id: own.id, name: 'Gut' });
    tidyStandards(db, 'en');
    expect(listActivities(db).map((activity) => activity.name)).toEqual(['Gut']);
  });

  it('does nothing on a tidy journal', () => {
    const db = createTestDb();
    const before = db.select().from(moods).all();
    tidyStandards(db, 'de');
    expect(db.select().from(moods).all()).toEqual(before);
  });
});
