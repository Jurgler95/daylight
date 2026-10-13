import { buildAchievements } from '@/lib/achievements';
import { addDaysToDateString, type DateString } from '@/lib/dates';
import { isStarterActivity } from '@/lib/daylio/known';

import { entryStreak, showRescueCard, streakChip, type StreakState } from '../index';

const T = '2026-10-13' as DateString;
const day = (offset: number, today: DateString = T) => addDaysToDateString(today, offset);
/** Days with an entry, as offsets from today (0 today, -1 yesterday). */
const on = (offsets: number[], today: DateString = T) => offsets.map((offset) => day(offset, today));
/** Offsets `from` to `to`, both included. */
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

describe('entryStreak', () => {
  it('is none for an empty diary', () => {
    expect(entryStreak([], T)).toEqual({ status: 'none', days: 0, todayDone: false, start: null, missing: [] });
  });

  it('is active from yesterday while today is still empty, and counts today once it has an entry', () => {
    expect(entryStreak(on(range(-5, -1)), T)).toMatchObject({ status: 'active', days: 5, todayDone: false, start: day(-5), missing: [] });
    expect(entryStreak(on(range(-5, 0)), T)).toMatchObject({ status: 'active', days: 6, todayDone: true, start: day(-5) });
  });

  it('counts a day with several entries once', () => {
    expect(entryStreak([...on(range(-2, 0)), day(0), day(-1)], T)).toMatchObject({ status: 'active', days: 3 });
  });

  it('is at risk when only yesterday is missing, whether or not today has an entry', () => {
    const empty = entryStreak(on(range(-10, -2)), T);
    expect(empty).toEqual({ status: 'atRisk', days: 9, todayDone: false, start: day(-10), missing: [day(-1)], restoredDays: 10 });
    const done = entryStreak(on([...range(-10, -2), 0]), T);
    expect(done).toMatchObject({ status: 'atRisk', days: 9, todayDone: true, missing: [day(-1)], restoredDays: 11 });
  });

  it('is broken with two days missing when the last entry is three days back', () => {
    expect(entryStreak(on(range(-6, -3)), T)).toEqual({
      status: 'broken',
      days: 0,
      todayDone: false,
      start: null,
      missing: [day(-2), day(-1)],
      restoredDays: 6,
      rescue: { anchor: day(-6), missing: [day(-2), day(-1)], restoredDays: 6, runBeforeGap: 4 },
    });
  });

  it('can still be rescued after a gap of exactly seven days', () => {
    const state = entryStreak(on(range(-12, -8)), T);
    expect(state).toMatchObject({ status: 'broken', restoredDays: 12, rescue: { anchor: day(-8), runBeforeGap: 5 } });
    expect(state.missing).toEqual(on(range(-7, -1)));
  });

  it('is gone after eight days, or a fresh streak of one with an entry today', () => {
    expect(entryStreak(on(range(-12, -9)), T)).toMatchObject({ status: 'none', days: 0, missing: [] });
    expect(entryStreak(on([...range(-12, -9), 0]), T)).toEqual({ status: 'active', days: 1, todayDone: true, start: T, missing: [] });
  });

  it('shows a broken streak as one day once today has an entry', () => {
    expect(entryStreak(on([...range(-6, -3), 0]), T)).toMatchObject({ status: 'broken', days: 1, todayDone: true, start: T, restoredDays: 7 });
  });

  it('keeps a partly filled gap as one gap, anchored on its oldest entry', () => {
    // Every day up to T-5, T-4 missing, T-3 filled in later, T-2 and T-1 missing.
    const state = entryStreak(on([...range(-20, -5), -3]), T);
    expect(state).toMatchObject({ status: 'broken', missing: [day(-4), day(-2), day(-1)], rescue: { anchor: day(-8) } });
    // Back to the run up to the anchor (T-20 to T-8), the seven days after it, nothing today.
    expect(state.restoredDays).toBe(20);
    // What the gap interrupted is the lone T-3 for now.
    expect(state.rescue?.runBeforeGap).toBe(1);
  });

  it('anchors on a lone entry three days back when the days before it are empty', () => {
    expect(entryStreak(on([...range(-20, -9), -3]), T)).toMatchObject({ status: 'broken', missing: [day(-2), day(-1)], restoredDays: 3, rescue: { anchor: day(-3), runBeforeGap: 1 } });
  });

  it('keeps offering a gap that was filled in from the wrong end, yesterday first', () => {
    // Every day up to T-5, then T-4 to T-2 missing; yesterday was filled in first.
    const days = on([...range(-20, -5), -1]);
    const state = entryStreak(days, T);
    expect(state).toMatchObject({ status: 'active', days: 1, start: day(-1), missing: on([-4, -3, -2]), restoredDays: 20 });
    expect(state.rescue).toEqual({ anchor: day(-8), missing: on([-4, -3, -2]), restoredDays: 20, runBeforeGap: 16 });
    days.push(day(-4), day(-3));
    expect(entryStreak(days, T)).toMatchObject({ status: 'active', days: 1, missing: [day(-2)], restoredDays: 20 });
    days.push(day(-2));
    const closed = entryStreak(days, T);
    expect(closed).toMatchObject({ status: 'active', days: 20, start: day(-20), missing: [] });
    expect(closed.rescue).toBeUndefined();
  });

  it('offers an old one day gap behind a running streak while it is within a week', () => {
    const days = on(range(-20, 0)).filter((date) => date !== day(-6));
    const state = entryStreak(days, T);
    expect(state).toMatchObject({ status: 'active', days: 6, todayDone: true, missing: [day(-6)], restoredDays: 21 });
    expect(state.rescue).toMatchObject({ anchor: day(-8), runBeforeGap: 14 });
  });

  it('lets a gap go once it lies more than a week back', () => {
    for (const gap of [-8, -9]) {
      const state = entryStreak(on(range(-20, 0)).filter((date) => date !== day(gap)), T);
      expect(state).toMatchObject({ status: 'active', days: -gap, missing: [] });
      expect(state.rescue).toBeUndefined();
    }
    // A gap seven days back is the last one still in reach.
    expect(entryStreak(on(range(-20, 0)).filter((date) => date !== day(-7)), T).rescue).toMatchObject({ anchor: day(-8), missing: [day(-7)] });
  });

  it('turns from broken to at risk and active as the gap is filled in, oldest day first', () => {
    const days = on(range(-10, -4));
    expect(entryStreak(days, T).missing).toEqual(on([-3, -2, -1]));
    days.push(day(-3));
    expect(entryStreak(days, T)).toMatchObject({ status: 'broken', missing: on([-2, -1]) });
    days.push(day(-2));
    expect(entryStreak(days, T)).toMatchObject({ status: 'atRisk', days: 9, restoredDays: 10 });
    days.push(day(-1));
    expect(entryStreak(days, T)).toMatchObject({ status: 'active', days: 10, start: day(-10) });
  });

  it('runs across the turn of the year', () => {
    const newYear = '2027-01-01' as DateString;
    expect(entryStreak(on(range(-4, 0), newYear), newYear)).toMatchObject({ status: 'active', days: 5, start: '2026-12-28' });
    expect(entryStreak(on(range(-6, -2), newYear), newYear)).toMatchObject({ status: 'atRisk', missing: ['2026-12-31'] });
  });

  it('ignores entries after today', () => {
    expect(entryStreak(on([...range(-3, -1), 1, 2]), T)).toMatchObject({ status: 'active', days: 3, todayDone: false });
    expect(entryStreak(on([1, 2]), T).status).toBe('none');
  });
});

describe('the streak and the achievement "days"', () => {
  const current = (dates: string[]) =>
    buildAchievements({ entries: dates.map((date) => ({ date, activity_ids: [], photos: [], scales: [] })), health: [], activities: [], isStarter: isStarterActivity, opens: 0, turningPoints: 0, today: T, firstDayOfWeek: 1 }).find(
      (achievement) => achievement.key === 'days',
    )!.current;

  it.each([
    ['today and before', on(range(-30, 0))],
    ['up to yesterday', on(range(-30, -1))],
    ['after a gap', on([...range(-30, -15), ...range(-6, -1)])],
    ['only today', on([0])],
    ['a fresh start after more than a week', on([...range(-30, -12), 0])],
    ['with entries after today', on([...range(-4, 0), 1, 3])],
  ])('have the same length while the streak is active: %s', (_, dates) => {
    const state = entryStreak(dates, T);
    expect(state.status).toBe('active');
    expect(state.days).toBe(current(dates));
  });
});

describe('streak chip', () => {
  const state = (dates: DateString[]): StreakState => entryStreak(dates, T);

  it('hides without a streak and shows from the first day', () => {
    expect(streakChip(state([]), false)).toBeNull();
    expect(streakChip(state(on([0])), false)).toEqual({ tone: 'filled', days: 1 });
  });

  it('is outlined until today has an entry, filled after', () => {
    expect(streakChip(state(on(range(-4, -1))), false)).toEqual({ tone: 'outline', days: 4 });
    expect(streakChip(state(on(range(-4, 0))), false)).toEqual({ tone: 'filled', days: 5 });
  });

  it('turns amber with the run up to the day before yesterday', () => {
    expect(streakChip(state(on(range(-8, -2))), false)).toEqual({ tone: 'amber', days: 7 });
    expect(streakChip(state(on([...range(-8, -2), 0])), false)).toEqual({ tone: 'amber', days: 7 });
  });

  it('shows a muted 0 or 1 next to the rescue card and the plain run once it is put away', () => {
    const broken = state(on(range(-8, -3)));
    expect(streakChip(broken, true)).toEqual({ tone: 'muted', days: 0 });
    expect(streakChip(broken, false)).toBeNull();
    const withToday = state(on([...range(-8, -3), 0]));
    expect(streakChip(withToday, true)).toEqual({ tone: 'muted', days: 1 });
    expect(streakChip(withToday, false)).toEqual({ tone: 'filled', days: 1 });
  });
});

describe('rescue card', () => {
  it('shows while a gap can be filled in: a broken streak, or a gap behind the run still going', () => {
    expect(showRescueCard(entryStreak(on(range(-8, -3)), T), null)).toBe(true);
    expect(showRescueCard(entryStreak(on(range(-8, -2)), T), null)).toBe(false);
    expect(showRescueCard(entryStreak(on(range(-8, -1)), T), null)).toBe(false);
    const behind = entryStreak(on([...range(-20, -7), ...range(-5, 0)]), T);
    expect(behind.status).toBe('active');
    expect(showRescueCard(behind, null)).toBe(true);
    // The chip keeps showing the run still going.
    expect(streakChip(behind, true)).toEqual({ tone: 'filled', days: 6 });
  });

  it('stays away for the gap it was put away for and comes back for the next one', () => {
    const dismissedOn = day(-1);
    // Put away yesterday, the gap still anchored on T-3.
    expect(showRescueCard(entryStreak(on(range(-8, -3)), T), dismissedOn)).toBe(false);
    // Still the same gap after a few more days without an entry.
    expect(showRescueCard(entryStreak(on(range(-8, -3)), day(3)), dismissedOn)).toBe(false);
    // An entry in between does not make a new gap while older days of the old one are still in the window.
    expect(showRescueCard(entryStreak(on([...range(-8, -3), -1]), day(3)), dismissedOn)).toBe(false);
    // A new gap after a few days with entries is anchored after the day it was put away.
    const later = day(10);
    expect(showRescueCard(entryStreak(on([...range(-8, -3), ...range(4, 6)]), later), dismissedOn)).toBe(true);
  });
});
