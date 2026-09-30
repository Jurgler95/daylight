import type { DateString } from '@/lib/dates';

import { DEFAULT_GROUPS, DEFAULT_MOODS, IMPORTED_GROUP } from '../known';
import type { RawEntry } from '../parse';
import { buildImportPlan, entryKey, fileOrder, type Catalog } from '../plan';

let line = 1;
const raw = (date: string, mood: string, activities: string[] = [], note: string | null = null, time = '20:00'): RawEntry => ({
  line: ++line,
  date: date as DateString,
  time,
  mood,
  activities,
  scales: [],
  noteTitle: null,
  note,
  photos: [],
});

const fresh = (): Catalog => ({
  moods: DEFAULT_MOODS.map((mood, i) => ({ id: i + 1, label: mood.label, level: mood.level, sort_order: i, archived: false })),
  groups: DEFAULT_GROUPS.map((name, i) => ({ id: i + 1, name })),
  activities: [],
  scales: [],
  entryKeys: new Set(),
  photoNames: new Set(),
});

describe('fileOrder', () => {
  it('merges the order hints of all rows', () => {
    expect(fileOrder([['a', 'c'], ['b', 'c'], ['a', 'b']])).toEqual(['a', 'b', 'c']);
  });

  it('falls back to first appearance for ties and contradictions', () => {
    expect(fileOrder([['x'], ['y']])).toEqual(['x', 'y']);
    expect(fileOrder([['a', 'b'], ['b', 'a']])).toEqual(['a', 'b']);
  });
});

describe('buildImportPlan', () => {
  it('matches standard moods, suggests groups for known activities and parks the rest', () => {
    const plan = buildImportPlan(
      [raw('2026-03-02', 'Gut', ['Müde', 'Mäßig', 'Sonnig', 'Töpfern']), raw('2026-03-01', 'Geht so', ['Sonnig'])],
      fresh(),
    );
    expect(plan.moods).toEqual([
      { key: 'gut', label: 'Gut', level: 4, existingId: 2, needsChoice: false, count: 1 },
      { key: 'geht so', label: 'Geht so', level: 3, existingId: null, needsChoice: true, count: 1 },
    ]);
    expect(plan.activities.map((a) => [a.name, a.group, a.existingId, a.count])).toEqual([
      ['Müde', 'Gefühle', null, 1],
      ['Mäßig', 'Schlaf', null, 1],
      ['Sonnig', 'Wetter', null, 2],
      ['Töpfern', IMPORTED_GROUP, null, 1],
    ]);
    expect(plan.newGroups).toEqual([IMPORTED_GROUP]);
    expect(plan).toMatchObject({ from: '2026-03-01', to: '2026-03-02', entryCount: 2, duplicates: 0 });
  });

  it('maps English standard moods onto the mood of that level', () => {
    const plan = buildImportPlan([raw('2026-03-01', 'rad'), raw('2026-03-02', 'awful')], fresh());
    expect(plan.moods.map((m) => [m.label, m.level, m.existingId])).toEqual([
      ['rad', 5, 1],
      ['awful', 1, 5],
    ]);
  });

  it('applies the choices from the preview', () => {
    const plan = buildImportPlan([raw('2026-03-01', 'Geht so', ['Töpfern'])], fresh(), {
      moodLevels: { 'geht so': 2 },
      activityGroups: { topfern: 'Orte und Freizeit' },
    });
    expect(plan.moods[0]).toMatchObject({ level: 2, needsChoice: false });
    expect(plan.activities[0]).toMatchObject({ group: 'Orte und Freizeit' });
    expect(plan.newGroups).toEqual([]);
  });

  it('finds existing activities by folded name', () => {
    const catalog = { ...fresh(), activities: [{ id: 7, group_id: 2, name: 'Mäßig' }] };
    const plan = buildImportPlan([raw('2026-03-01', 'Gut', ['MÄSSIG'])], catalog);
    expect(plan.activities[0]).toMatchObject({ existingId: 7, group: 'Schlaf' });
  });

  it('skips entries that are stored already or repeated in the file', () => {
    const catalog = { ...fresh(), entryKeys: new Set([entryKey('2026-03-01', '20:00', 4, 'alt')]) };
    const plan = buildImportPlan(
      [raw('2026-03-01', 'Gut', [], 'alt'), raw('2026-03-02', 'Gut', [], 'neu'), raw('2026-03-02', 'gut', [], 'neu'), raw('2026-03-02', 'Gut', [], 'neu', '21:00')],
      catalog,
    );
    expect(plan.duplicates).toBe(2);
    expect(plan.entries.map((e) => [e.raw.date, e.raw.time])).toEqual([
      ['2026-03-02', '20:00'],
      ['2026-03-02', '21:00'],
    ]);
  });

  it('counts an entry with another mood level or note as new', () => {
    const catalog = { ...fresh(), entryKeys: new Set([entryKey('2026-03-01', '20:00', 4, null)]) };
    const plan = buildImportPlan([raw('2026-03-01', 'Super'), raw('2026-03-01', 'Gut', [], 'x')], catalog);
    expect(plan.duplicates).toBe(0);
  });

  it('plans new scales with a range that holds every value', () => {
    const entry = { ...raw('2026-03-01', 'Gut'), scales: [{ name: 'Energie', value: 12 }] };
    expect(buildImportPlan([entry], fresh()).newScales).toEqual([{ name: 'Energie', min: 0, max: 12 }]);
  });

  it('handles an empty file', () => {
    expect(buildImportPlan([], fresh())).toMatchObject({ from: null, to: null, entryCount: 0, moods: [], activities: [] });
  });
});
