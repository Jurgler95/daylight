import type { Mood } from '@/db/schema';
import type { DateString } from '@/lib/dates';

import { buildWidgetState } from '../state';

const day = '2026-11-25' as DateString;
const mood = (id: number, level: number, icon: string): Mood => ({
  id,
  level,
  icon,
  label: `m${id}`,
  sort_order: 0,
  archived: false,
});

describe('buildWidgetState', () => {
  it('keeps the first five moods in order with their code points', () => {
    const moods = [mood(5, 5, 'a'), mood(4, 4, 'b'), mood(3, 3, 'c'), mood(2, 2, 'd'), mood(1, 1, 'e'), mood(6, 1, 'f')];
    const state = buildWidgetState({
      title: 'Q',
      font: 'font',
      moods,
      glyphs: { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 },
      date: day,
      moodId: 3,
    });
    expect(state.moods.map((m) => m.id)).toEqual([5, 4, 3, 2, 1]);
    expect(state.moods[0]).toEqual({ id: 5, level: 5, glyph: 1, label: 'm5' });
    expect(state).toMatchObject({
      title: 'Q',
      font: 'font',
      date: day,
      moodId: 3,
    });
  });

  it('marks an unknown or non-numeric glyph as 0, so the widget draws the initial', () => {
    const state = buildWidgetState({
      title: 'Q',
      font: null,
      moods: [mood(1, 3, 'x'), mood(2, 2, 'y')],
      glyphs: { y: '?' },
      date: day,
      moodId: null,
    });
    expect(state.moods.map((m) => m.glyph)).toEqual([0, 0]);
  });

  it('keeps the days of the last six weeks with their icons, and only that they exist behind the app lock', () => {
    const days = new Map([
      ['2026-11-25', { level: 4, icon: 'b' }],
      ['2026-10-15', { level: 2, icon: 'd' }],
      ['2026-10-14', { level: 1, icon: 'e' }],
    ]);
    const glyphs = { b: 2, d: 4, e: 5 };
    const open = buildWidgetState({
      title: 'Q',
      font: null,
      moods: [],
      glyphs,
      date: day,
      moodId: 7,
      days,
    });
    expect(open.days).toEqual({
      '2026-11-25': { level: 4, glyph: 2 },
      '2026-10-15': { level: 2, glyph: 4 },
    });
    const locked = buildWidgetState({
      title: 'Q',
      font: null,
      moods: [],
      glyphs,
      date: day,
      moodId: 7,
      days,
      locked: true,
    });
    expect(locked.days).toEqual({
      '2026-11-25': { level: 0, glyph: 0 },
      '2026-10-15': { level: 0, glyph: 0 },
    });
    expect(locked.moodId).toBeNull();
    expect(locked.locked).toBe(true);
  });

  it('hands over the streak with whether it is at risk', () => {
    const state = buildWidgetState({
      title: 'Q',
      font: null,
      moods: [],
      glyphs: {},
      date: day,
      moodId: null,
      streak: { status: 'atRisk', days: 6, todayDone: false },
      streakLabel: 'days in a row',
      streakLabelZero: 'days in a row',
    });
    expect(state.streak).toEqual({ days: 6, todayDone: false, atRisk: true });
    expect(
      buildWidgetState({
        title: 'Q',
        font: null,
        moods: [],
        glyphs: {},
        date: day,
        moodId: null,
      }).streak,
    ).toEqual({ days: 0, todayDone: false, atRisk: false });
  });
});
