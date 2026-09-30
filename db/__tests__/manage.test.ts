import { eq } from 'drizzle-orm';

import {
  activityUsage,
  createActivity,
  createEntry,
  createGroup,
  createScale,
  getActivity,
  getEntryDetails,
  listActivities,
  listEntryDetails,
  listGroups,
  listMoods,
  listPlannedActivities,
  mergeActivities,
  moodUsage,
  reorderActivities,
  reorderGroups,
  saveEntry,
  setPlannedActivities,
  updateActivity,
  updateGroup,
  updateMood,
  updateScale,
} from '../repositories';
import { entryActivities } from '../schema';
import { createTestDb } from '../testDb';
import { LastMoodError, NameTakenError } from '../types';

function setup() {
  const db = createTestDb();
  const [feelings, sleep, , , work] = listGroups(db);
  const mood = listMoods(db)[1]!;
  const urlaub = createActivity(db, { group_id: work!.id, name: 'Urlaub' });
  const ferien = createActivity(db, { group_id: work!.id, name: 'Ferien' });
  const tired = createActivity(db, { group_id: feelings!.id, name: 'Müde' });
  return { db, feelings: feelings!, sleep: sleep!, work: work!, mood, urlaub, ferien, tired };
}

describe('mergeActivities', () => {
  it('moves every entry to the remaining activity without duplicate links', () => {
    const { db, mood, urlaub, ferien, tired } = setup();
    const both = createEntry(db, { date: '2026-09-01', time: '20:00', mood_id: mood.id, activity_ids: [urlaub.id, ferien.id, tired.id] });
    const onlyFerien = createEntry(db, { date: '2026-09-02', time: '20:00', mood_id: mood.id, activity_ids: [ferien.id] });
    const onlyUrlaub = createEntry(db, { date: '2026-09-03', time: '20:00', mood_id: mood.id, activity_ids: [urlaub.id] });

    expect(mergeActivities(db, ferien.id, urlaub.id)).toBe(2);

    expect(getActivity(db, ferien.id)).toBeUndefined();
    expect(getEntryDetails(db, both.id)?.activity_ids.sort()).toEqual([urlaub.id, tired.id].sort());
    expect(getEntryDetails(db, onlyFerien.id)?.activity_ids).toEqual([urlaub.id]);
    expect(getEntryDetails(db, onlyUrlaub.id)?.activity_ids).toEqual([urlaub.id]);
    const links = db.select().from(entryActivities).where(eq(entryActivities.entry_id, both.id)).all();
    expect(links).toHaveLength(2);
    expect(activityUsage(db).get(urlaub.id)).toBe(3);
  });

  it('moves plans as well', () => {
    const { db, urlaub, ferien } = setup();
    setPlannedActivities(db, '2026-10-01', [urlaub.id, ferien.id]);
    setPlannedActivities(db, '2026-10-02', [ferien.id]);
    mergeActivities(db, ferien.id, urlaub.id);
    expect(listPlannedActivities(db).map((plan) => [plan.date, plan.activity_id])).toEqual([
      ['2026-10-01', urlaub.id],
      ['2026-10-02', urlaub.id],
    ]);
  });

  it('merges across groups and refuses to merge into itself', () => {
    const { db, mood, urlaub, tired } = setup();
    createEntry(db, { date: '2026-09-01', time: '20:00', mood_id: mood.id, activity_ids: [tired.id] });
    mergeActivities(db, tired.id, urlaub.id);
    expect(listEntryDetails(db)[0]?.activity_ids).toEqual([urlaub.id]);
    expect(() => mergeActivities(db, urlaub.id, urlaub.id)).toThrow('itself');
  });
});

describe('updateActivity', () => {
  it('moves to the end of another group', () => {
    const { db, sleep, urlaub } = setup();
    const good = createActivity(db, { group_id: sleep.id, name: 'Gut' });
    const moved = updateActivity(db, urlaub.id, { group_id: sleep.id });
    expect(moved.sort_order).toBe(good.sort_order + 1);
    expect(listActivities(db).filter((a) => a.group_id === sleep.id).map((a) => a.name)).toEqual(['Gut', 'Urlaub']);
  });

  it('refuses a name the target group already has, archived ones included', () => {
    const { db, feelings, work, urlaub, ferien } = setup();
    expect(() => updateActivity(db, ferien.id, { name: 'urlaub' })).toThrow(NameTakenError);
    const other = createActivity(db, { group_id: feelings.id, name: 'Urlaub' });
    updateActivity(db, other.id, { archived: true });
    expect(() => updateActivity(db, urlaub.id, { group_id: feelings.id })).toThrow(NameTakenError);
    // Renaming to its own name with other casing is fine.
    expect(updateActivity(db, urlaub.id, { name: 'URLAUB' }).name).toBe('URLAUB');
    expect(getActivity(db, urlaub.id)?.group_id).toBe(work.id);
  });

  it('keeps archived activities out of the default list', () => {
    const { db, urlaub } = setup();
    updateActivity(db, urlaub.id, { archived: true });
    expect(listActivities(db).map((a) => a.name)).not.toContain('Urlaub');
    expect(listActivities(db, { includeArchived: true }).map((a) => a.name)).toContain('Urlaub');
  });
});

describe('order', () => {
  it('writes activity and group order as listed', () => {
    const { db, work, urlaub, ferien } = setup();
    reorderActivities(db, [ferien.id, urlaub.id]);
    expect(listActivities(db).filter((a) => a.group_id === work.id).map((a) => a.name)).toEqual(['Ferien', 'Urlaub']);
    const groups = listGroups(db);
    reorderGroups(db, [...groups].reverse().map((g) => g.id));
    expect(listGroups(db).map((g) => g.name)[0]).toBe('Orte und Freizeit');
    expect(listActivities(db)[0]?.name).toBe('Ferien');
  });
});

describe('groups, moods, scales', () => {
  it('refuses a group name that is taken', () => {
    const { db, sleep } = setup();
    expect(() => updateGroup(db, sleep.id, { name: 'gefuhle' })).toThrow(NameTakenError);
    expect(updateGroup(db, sleep.id, { name: 'Nacht' }).name).toBe('Nacht');
    expect(createGroup(db, 'nacht').id).toBe(sleep.id);
  });

  it('keeps at least one mood', () => {
    const { db } = setup();
    const moods = listMoods(db);
    for (const mood of moods.slice(1)) updateMood(db, mood.id, { archived: true });
    expect(() => updateMood(db, moods[0]!.id, { archived: true })).toThrow(LastMoodError);
    expect(listMoods(db)).toHaveLength(1);
  });

  it('counts mood use', () => {
    const { db, mood } = setup();
    createEntry(db, { date: '2026-09-01', time: '20:00', mood_id: mood.id });
    expect(moodUsage(db).get(mood.id)).toBe(1);
  });

  it('renames scales but refuses taken names', () => {
    const { db } = setup();
    const energy = createScale(db, { name: 'Energie', min: 1, max: 5 });
    createScale(db, { name: 'Stress' });
    expect(() => updateScale(db, energy.id, { name: 'stress' })).toThrow(NameTakenError);
    expect(updateScale(db, energy.id, { name: 'Kraft', archived: true })).toMatchObject({ name: 'Kraft', archived: true, min: 1, max: 5 });
  });
});

describe('saveEntry', () => {
  it('creates, then replaces activities and scales', () => {
    const { db, mood, urlaub, tired } = setup();
    const scale = createScale(db, { name: 'Energie', min: 1, max: 5 });
    const created = saveEntry(db, null, { date: '2026-09-01', time: '20:00', mood_id: mood.id, activity_ids: [urlaub.id], scales: [{ scale_id: scale.id, value: 3 }] });
    saveEntry(db, created.id, { date: '2026-09-02', time: '21:00', mood_id: mood.id, note: 'Neu', activity_ids: [tired.id], scales: [] });
    expect(getEntryDetails(db, created.id)).toMatchObject({ date: '2026-09-02', time: '21:00', note: 'Neu', activity_ids: [tired.id], scales: [], level: 4 });
  });

  it('leaves nothing behind when the input is invalid', () => {
    const { db, mood } = setup();
    expect(() => saveEntry(db, null, { date: '2026-02-30', time: '20:00', mood_id: mood.id })).toThrow('date');
    expect(listEntryDetails(db)).toHaveLength(0);
  });
});
