import { createActivity, createMood, listActivities, listGroups, listMoods, listScales, updateActivity, updateGroup, updateMood } from '@/db/repositories';
import { createTestDb } from '@/db/testDb';

import { activityLabel, buildCatalog, editorGroups, levelMood } from '../catalog';

function load(db: ReturnType<typeof createTestDb>) {
  return buildCatalog({
    moods: listMoods(db, { includeArchived: true }),
    groups: listGroups(db),
    activities: listActivities(db, { includeArchived: true }),
    scales: listScales(db, { includeArchived: true }),
  });
}

describe('catalog', () => {
  it('orders moods by level, custom ones after the standard mood of their level', () => {
    const db = createTestDb();
    createMood(db, { label: 'Erschöpft', level: 2 });
    expect(load(db).moods.map((mood) => mood.label)).toEqual(['Super', 'Gut', 'Ok', 'Schlecht', 'Erschöpft', 'Mies']);
  });

  it('names a level after its first active mood, or the standard name', () => {
    const db = createTestDb();
    const gut = listMoods(db).find((mood) => mood.level === 4)!;
    updateMood(db, gut.id, { label: 'Schön' });
    expect(levelMood(load(db), 4).label).toBe('Schön');
    updateMood(db, gut.id, { archived: true });
    expect(levelMood(load(db), 4)).toEqual({ label: 'Gut', icon: 'emoticon-happy-outline' });
  });

  it('offers archived activities only where they are set', () => {
    const db = createTestDb();
    const [feelings, sleep] = listGroups(db);
    const tired = createActivity(db, { group_id: feelings!.id, name: 'Müde' });
    const angry = createActivity(db, { group_id: feelings!.id, name: 'Wütend' });
    const good = createActivity(db, { group_id: sleep!.id, name: 'Gut' });
    updateActivity(db, angry.id, { archived: true });
    updateGroup(db, sleep!.id, { archived: true });

    const plain = editorGroups(load(db), []);
    expect(plain.map((g) => [g.group.name, g.activities.map((a) => a.name)])[0]).toEqual(['Gefühle', ['Müde']]);
    expect(plain.some((g) => g.group.name === 'Schlaf')).toBe(false);

    const set = editorGroups(load(db), [angry.id, good.id, tired.id]);
    expect(set[0]?.activities.map((a) => a.name)).toEqual(['Müde', 'Wütend']);
    expect(set[set.length - 1]?.activities.map((a) => a.name)).toEqual(['Gut']);
  });

  it('adds the group to an activity name that is also a mood or another activity', () => {
    const db = createTestDb();
    const [feelings, sleep, weather] = listGroups(db);
    const poorSleep = createActivity(db, { group_id: sleep!.id, name: 'Schlecht' });
    const tired = createActivity(db, { group_id: feelings!.id, name: 'Müde' });
    const sunnyA = createActivity(db, { group_id: weather!.id, name: 'Sonnig' });
    const sunnyB = createActivity(db, { group_id: feelings!.id, name: 'sonnig' });
    const catalog = load(db);
    expect(activityLabel(catalog, poorSleep.id)).toBe(`Schlecht (${sleep!.name})`);
    expect(activityLabel(catalog, tired.id)).toBe('Müde');
    expect(activityLabel(catalog, sunnyA.id)).toBe(`Sonnig (${weather!.name})`);
    expect(activityLabel(catalog, sunnyB.id)).toBe(`sonnig (${feelings!.name})`);
    expect(activityLabel(catalog, 9999)).toBe('');
  });
});
