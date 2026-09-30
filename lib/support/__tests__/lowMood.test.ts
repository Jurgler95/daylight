import { addDaysToDateString, type DateString } from '@/lib/dates';

import { lowDays, showLowMoodNote } from '../lowMood';

const today = '2026-09-26' as DateString;
/** Levels for today, yesterday, ... */
const levels = (values: (number | null)[]) =>
  new Map(values.flatMap((level, i) => (level === null ? [] : [[addDaysToDateString(today, -i), level] as [DateString, number]])));

describe('low mood note', () => {
  it('shows at seven of the last ten days at level 2 or below', () => {
    const seven = levels([2, 1, 2, 4, 2, 2, 3, 2, 2, 4]);
    expect(lowDays(seven, today)).toBe(7);
    expect(showLowMoodNote({ levels: seven, today, dismissedOn: null })).toBe(true);
    const six = levels([2, 1, 2, 4, 2, 2, 3, 2, 3, 4]);
    expect(showLowMoodNote({ levels: six, today, dismissedOn: null })).toBe(false);
  });

  it('only looks at the last ten days and reads nothing into gaps', () => {
    const old = levels([4, 4, 4, null, null, null, null, 4, 4, 4, 1, 1, 1, 1, 1, 1, 1]);
    expect(showLowMoodNote({ levels: old, today, dismissedOn: null })).toBe(false);
    const gaps = levels([2, null, 2, null, 2, 2, null, 2, 2, 2]);
    expect(lowDays(gaps, today)).toBe(7);
  });

  it('stays away for fourteen days after being put away', () => {
    const low = levels([1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
    expect(showLowMoodNote({ levels: low, today, dismissedOn: today })).toBe(false);
    expect(showLowMoodNote({ levels: low, today, dismissedOn: addDaysToDateString(today, -13) })).toBe(false);
    expect(showLowMoodNote({ levels: low, today, dismissedOn: addDaysToDateString(today, -14) })).toBe(true);
  });
});
