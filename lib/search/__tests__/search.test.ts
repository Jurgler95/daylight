import type { MoodLevel } from '@/db/schema';
import type { DateString } from '@/lib/dates';

import {
  EMPTY_QUERY,
  excerpt,
  groupByMonth,
  indexEntries,
  isEmptyQuery,
  periodStart,
  searchEntries,
  SNIPPET_LENGTH,
  topActivities,
  type SearchableEntry,
  type SearchQuery,
} from '..';

const d = (s: string) => s as DateString;
const TODAY = d('2026-09-26');

const ACTIVITIES: Record<number, string> = { 1: 'Familie', 2: 'Müde', 3: 'Sonnig', 4: 'Regnerisch' };
const MOODS: Record<number, string> = { 10: 'Super', 11: 'Gut', 12: 'Schlecht' };
const labels = { activity: (id: number) => ACTIVITIES[id], mood: (id: number) => MOODS[id] };

let nextId = 1;
function entry(date: string, level: MoodLevel, activity_ids: number[], note: string | null = null, time = '20:00'): SearchableEntry {
  const mood_id = level === 5 ? 10 : level === 4 ? 11 : 12;
  return { id: nextId++, date: d(date), time, level, mood_id, note_title: null, note, activity_ids };
}

const entries = [
  entry('2026-09-25', 4, [1, 3], 'Grillen im Garten, Kuchen von Oma'),
  entry('2026-09-20', 2, [2, 4], 'Den ganzen Tag Kopfweh'),
  entry('2026-09-20', 5, [1], 'Abends Besuch', '21:30'),
  entry('2026-06-01', 4, [3], null),
  entry('2025-12-30', 2, [2], 'Fußweg zur Arbeit, müde'),
];
const index = indexEntries(entries, labels);
const search = (query: Partial<SearchQuery>) => searchEntries(index, { ...EMPTY_QUERY, ...query }, TODAY);
const ids = (query: Partial<SearchQuery>) => search(query).map((hit) => hit.entry.date + ' ' + hit.entry.time);

describe('searchEntries', () => {
  it('returns every entry newest first for the empty query', () => {
    expect(isEmptyQuery(EMPTY_QUERY)).toBe(true);
    expect(ids({})).toEqual(['2026-09-25 20:00', '2026-09-20 21:30', '2026-09-20 20:00', '2026-06-01 20:00', '2025-12-30 20:00']);
  });

  it('finds notes regardless of case and accents', () => {
    expect(ids({ text: 'fussweg' })).toEqual(['2025-12-30 20:00']);
    expect(ids({ text: 'KUCHEN' })).toEqual(['2026-09-25 20:00']);
  });

  it('finds activities and moods by name', () => {
    expect(ids({ text: 'mude' })).toEqual(['2026-09-20 20:00', '2025-12-30 20:00']);
    expect(ids({ text: 'super' })).toEqual(['2026-09-20 21:30']);
  });

  it('needs every word of the text somewhere in the entry', () => {
    expect(ids({ text: 'familie oma' })).toEqual(['2026-09-25 20:00']);
    expect(ids({ text: 'familie kopfweh' })).toEqual([]);
  });

  it('combines activity chips with AND', () => {
    expect(ids({ activityIds: [1] })).toHaveLength(2);
    expect(ids({ activityIds: [1, 3] })).toEqual(['2026-09-25 20:00']);
    expect(ids({ activityIds: [1, 2] })).toEqual([]);
  });

  it('filters by any of the chosen levels', () => {
    expect(ids({ levels: [2] })).toEqual(['2026-09-20 20:00', '2025-12-30 20:00']);
    expect(ids({ levels: [5, 2] })).toHaveLength(3);
  });

  it('filters by period ending today', () => {
    expect(periodStart('30', TODAY)).toBe('2026-08-28');
    expect(periodStart('all', TODAY)).toBeNull();
    expect(ids({ period: '30' })).toHaveLength(3);
    expect(ids({ period: '365' })).toHaveLength(5);
    expect(ids({ period: '90', text: 'sonnig' })).toEqual(['2026-09-25 20:00']);
  });

  it('reports the activities that matched a chip or the text', () => {
    const [hit] = search({ activityIds: [3], text: 'famil' });
    expect(hit?.matchedActivityIds).toEqual([1, 3]);
  });

  it('keeps a missing note as null', () => {
    expect(search({ text: 'sonnig', period: '365' }).map((hit) => hit.snippet)).toEqual(['Grillen im Garten, Kuchen von Oma', null]);
  });
});

describe('excerpt', () => {
  const long = `${'Anfang '.repeat(40)}Kopfweh am Abend ${'Ende '.repeat(40)}`;

  it('centres long notes on the hit and marks cuts', () => {
    const snippet = excerpt(long, 'kopfweh') ?? '';
    expect(snippet.startsWith('…')).toBe(true);
    expect(snippet.endsWith('…')).toBe(true);
    expect(snippet).toContain('Kopfweh');
    expect(snippet.length).toBeLessThanOrEqual(SNIPPET_LENGTH + 2);
  });

  it('starts at the beginning without a hit', () => {
    expect(excerpt(long, null)?.startsWith('Anfang')).toBe(true);
    expect(excerpt('  ', null)).toBeNull();
  });
});

describe('topActivities', () => {
  it('orders by use and drops unused ones', () => {
    expect(topActivities(entries, [1, 2, 3, 4], 3)).toEqual([1, 2, 3]);
    expect(topActivities(entries, [4, 3, 2, 1], 10)).toEqual([3, 2, 1, 4]);
  });
});

describe('groupByMonth', () => {
  it('starts a section at every month change', () => {
    const sections = groupByMonth(search({}), (hit) => hit.entry.date);
    expect(sections.map((section) => [section.month, section.data.length])).toEqual([
      ['2026-09-01', 3],
      ['2026-06-01', 1],
      ['2025-12-01', 1],
    ]);
  });
});
