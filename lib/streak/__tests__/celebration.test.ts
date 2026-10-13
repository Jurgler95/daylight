import { addDaysToDateString, type DateString } from '@/lib/dates';

import { celebratedDays, celebrationFor, celebrationStage, entryStreak, milestoneFor, parseCelebrated, shouldCelebrate } from '../index';

const T = '2026-10-13' as DateString;
const day = (offset: number) => addDaysToDateString(T, offset);
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => day(from + i));

describe('milestoneFor', () => {
  it('celebrates every 10, 50 and 200 days, the biggest where they coincide', () => {
    expect(milestoneFor(9, 10)).toBe('small');
    expect(milestoneFor(10, 11)).toBeNull();
    expect(milestoneFor(49, 50)).toBe('large');
    expect(milestoneFor(199, 200)).toBe('huge');
    expect(milestoneFor(399, 400)).toBe('huge');
    expect(milestoneFor(0, 1)).toBeNull();
  });

  it('takes the biggest of the thresholds a jump passes, once', () => {
    expect(milestoneFor(45, 103)).toBe('large');
    expect(milestoneFor(12, 38)).toBe('small');
    expect(milestoneFor(150, 230)).toBe('huge');
    expect(milestoneFor(20, 20)).toBeNull();
    expect(milestoneFor(30, 25)).toBeNull();
  });
});

describe('stored celebrations', () => {
  it('reads only a well formed record', () => {
    expect(parseCelebrated('{"start":"2026-09-01","days":20}')).toEqual({ start: '2026-09-01', days: 20 });
    expect(parseCelebrated(null)).toBeNull();
    expect(parseCelebrated('nope')).toBeNull();
    expect(parseCelebrated('{"start":"1.9.2026","days":20}')).toBeNull();
    expect(parseCelebrated('{"start":"2026-09-01"}')).toBeNull();
  });

  it('belongs to the streak while its start lies inside the run', () => {
    const stored = { start: day(-20), days: 20 };
    expect(celebratedDays(stored, day(-20), 21)).toBe(20);
    // Filled in days before the start: the same streak.
    expect(celebratedDays(stored, day(-25), 26)).toBe(20);
    // A streak that began after it: another one.
    expect(celebratedDays(stored, day(-5), 6)).toBe(0);
    expect(celebratedDays(null, day(-5), 6)).toBe(0);
  });

  it('celebrates each threshold once per streak', () => {
    const stored = { start: day(-9), days: 10 };
    expect(shouldCelebrate(stored, day(-9), 10, 9)).toBeNull();
    expect(shouldCelebrate(stored, day(-19), 20, 19)).toBe('small');
    // A new streak celebrates again.
    expect(shouldCelebrate(stored, day(30), 10, 9)).toBe('small');
  });
});

describe('celebrationFor', () => {
  const save = (before: string[], added: string[], stored: { start: DateString; days: number } | null = null) =>
    celebrationFor(entryStreak(before, T), entryStreak([...before, ...added], T), stored);

  it('celebrates the tenth day written today and stores the record', () => {
    expect(save(range(-9, -1), [day(0)])).toEqual({ celebration: { milestone: 'small', rescued: false, days: 10 }, record: { start: day(-9), days: 10 } });
  });

  it('stays quiet without a threshold, and for an entry written again after deleting it', () => {
    expect(save(range(-10, -1), [day(0)])).toBeNull();
    expect(save(range(-9, -1), [day(0)], { start: day(-9), days: 10 })).toBeNull();
  });

  it('does not celebrate an existing streak for thresholds it passed before', () => {
    // A long streak on an install without a record: only the step from 119 to 120 counts.
    expect(save(range(-119, -1), [day(0)])?.celebration).toEqual({ milestone: 'small', rescued: false, days: 120 });
    expect(save(range(-120, -1), [day(0)])).toBeNull();
  });

  it('says the streak was saved when yesterday is filled in', () => {
    expect(save(range(-6, -2), [day(-1)])).toEqual({ celebration: { milestone: null, rescued: true, days: 6 }, record: null });
  });

  it('only rescues once the whole gap is closed', () => {
    const before = range(-20, -4);
    expect(save(before, [day(-3)])).toBeNull();
    expect(save([...before, day(-3)], [day(-2)])).toBeNull();
    expect(save([...before, day(-3), day(-2)], [day(-1)])).toEqual({ celebration: { milestone: 'small', rescued: true, days: 20 }, record: { start: day(-20), days: 20 } });
  });

  it('takes the run before the gap as the length before the save', () => {
    // Every day from T-50 to T-4, a gap of three, closed with today already written: 51 passes 50.
    const before = [...range(-50, -4), day(0)];
    const after = entryStreak([...before, ...range(-3, -1)], T);
    expect(celebrationFor(entryStreak(before, T), after, null)?.celebration).toEqual({ milestone: 'large', rescued: true, days: 51 });
    // Already celebrated at 50 before the gap: just the rescue.
    expect(celebrationFor(entryStreak(before, T), after, { start: day(-50), days: 50 })?.celebration).toEqual({ milestone: null, rescued: true, days: 51 });
  });

  it('says the streak was saved when a gap behind the run still going is closed', () => {
    // Yesterday was filled in first, then the older missing days; the last one closes the gap.
    expect(save([...range(-8, -3), day(-1)], [day(-2)])).toEqual({ celebration: { milestone: null, rescued: true, days: 8 }, record: null });
    // Not yet while a day of it is still missing.
    expect(save([...range(-8, -5), day(-1)], [day(-4)])).toBeNull();
  });

  it('takes the run still going as the length before closing a gap behind it', () => {
    const before = [...range(-20, -5), day(-4), day(-3), day(-1)];
    expect(save(before, [day(-2)])?.celebration).toEqual({ milestone: 'small', rescued: true, days: 20 });
    expect(save(before, [day(-2)], { start: day(-20), days: 20 })?.celebration).toEqual({ milestone: null, rescued: true, days: 20 });
  });

  it('never celebrates a streak that gets shorter or a day outside it', () => {
    expect(save(range(-9, -1), [day(-30)])).toBeNull();
    expect(celebrationFor(entryStreak(range(-9, 0), T), entryStreak(range(-9, -1), T), null)).toBeNull();
  });
});

describe('celebrationStage', () => {
  it('pulses for small steps, slides a banner in for 50 or a rescue and takes the screen at 200', () => {
    expect(celebrationStage({ milestone: 'small', rescued: false, days: 10 })).toBe('pulse');
    expect(celebrationStage({ milestone: 'small', rescued: true, days: 10 })).toBe('banner');
    expect(celebrationStage({ milestone: null, rescued: true, days: 4 })).toBe('banner');
    expect(celebrationStage({ milestone: 'large', rescued: false, days: 50 })).toBe('banner');
    expect(celebrationStage({ milestone: 'huge', rescued: true, days: 200 })).toBe('overlay');
  });
});
