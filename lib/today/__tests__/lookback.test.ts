import type { DateString } from '@/lib/dates';

import { lookbackDays, summariseDay } from '../lookback';

const d = (s: string) => s as DateString;

describe('lookback', () => {
  it('looks back a week, a month, six months and a year', () => {
    expect(lookbackDays(d('2026-09-26'))).toEqual([
      { key: 'week', date: '2026-09-19' },
      { key: 'month', date: '2026-08-26' },
      { key: 'halfYear', date: '2026-03-26' },
      { key: 'year', date: '2025-09-26' },
    ]);
  });

  it('clamps to the end of a shorter month', () => {
    expect(lookbackDays(d('2026-03-31')).map((day) => day.date)).toEqual(['2026-03-24', '2026-02-28', '2025-09-30', '2025-03-31']);
    expect(lookbackDays(d('2028-02-29')).at(-1)?.date).toBe('2027-02-28');
  });
});

describe('summariseDay', () => {
  const entry = (id: number, level: number, note: string | null = null) => ({ id, mood_id: 10 + level, level, note });

  it('is null for a day without entries and plain for a day with one', () => {
    expect(summariseDay([])).toBeNull();
    expect(summariseDay([entry(1, 4, 'ruhig')])).toEqual({ level: 4, moodId: 14, count: 1, note: 'ruhig', entryIds: [1] });
  });

  it('shows the mean of several entries like the calendar, rounded half up', () => {
    // Ok and Gut make Gut, and the mood named is the entry that sits on that level.
    expect(summariseDay([entry(1, 3), entry(2, 4)])).toMatchObject({ level: 4, moodId: 14, count: 2 });
    // Schlecht and Super make Ok without an entry of that mood: the level's own mood stands in.
    expect(summariseDay([entry(1, 2), entry(2, 5), entry(3, 2)])).toMatchObject({ level: 3, moodId: null, count: 3 });
  });

  it('takes the note of the newest entry that has one, and lists the entries newest first', () => {
    const day = summariseDay([entry(1, 4, 'morgens'), entry(2, 4, 'mittags'), entry(3, 4, '  ')]);
    expect(day).toMatchObject({ note: 'mittags', entryIds: [3, 2, 1] });
    expect(summariseDay([{ id: 1, mood_id: 14, level: 4, note_title: 'Titel', note: 'Text' }])?.note).toBe('Titel Text');
    expect(summariseDay([entry(1, 4), entry(2, 4)])?.note).toBe('');
  });
});
