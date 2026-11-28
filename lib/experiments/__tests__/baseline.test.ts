import { addDaysToDateString, type DateString } from '@/lib/dates';

import { BASELINE_DAYS, experimentBaseline } from '../baseline';

const today = '2026-11-27' as DateString;
const daysBack = (from: number, to: number) => new Set(Array.from({ length: to - from + 1 }, (_, i) => addDaysToDateString(today, -(from + i))));

describe('experimentBaseline', () => {
  it('asks for two weeks before a four-week experiment and suggests a start once they will be there', () => {
    const first = experimentBaseline(new Set([today]), today, 28, today);
    expect(first).toEqual({ days: 0, needed: BASELINE_DAYS, enough: false, later: addDaysToDateString(today, 14) });
    // Five days on record before today: nine more from today on.
    const some = experimentBaseline(daysBack(1, 5), today, 28, today);
    expect(some).toMatchObject({ days: 5, enough: false, later: addDaysToDateString(today, 9) });
  });

  it('is content with two weeks of entries in the stretch before', () => {
    expect(experimentBaseline(daysBack(1, 14), today, 28, today)).toEqual({ days: 14, needed: 14, enough: true, later: null });
    // Entries older than the stretch the comparison uses do not count.
    expect(experimentBaseline(daysBack(1, 14), today, 7, today)).toMatchObject({ days: 7, needed: 7, enough: true });
    expect(experimentBaseline(daysBack(30, 60), today, 28, today)).toMatchObject({ days: 0, enough: false });
  });

  it('never asks for more days than the experiment lasts', () => {
    expect(experimentBaseline(new Set(), today, 7, today)).toMatchObject({ needed: 7, later: addDaysToDateString(today, 7) });
  });

  it('counts the days before a start in the future and moves it later only', () => {
    const start = addDaysToDateString(today, 10);
    // Ten days until the start, all of them still to come, plus four on record: enough.
    expect(experimentBaseline(daysBack(1, 4), start, 28, today)).toMatchObject({ days: 4, enough: true, later: null });
    // With three on record one day is missing, so one day later.
    expect(experimentBaseline(daysBack(1, 3), start, 28, today)).toMatchObject({ days: 3, enough: false, later: addDaysToDateString(start, 1) });
    // A start in the past is moved to today at the earliest.
    const past = addDaysToDateString(today, -20);
    expect(experimentBaseline(new Set(), past, 28, today).later).toBe(addDaysToDateString(today, 14));
  });

  it('takes a start two weeks or more ahead as it is', () => {
    expect(experimentBaseline(new Set(), addDaysToDateString(today, 14), 28, today)).toMatchObject({ days: 0, enough: true, later: null });
    expect(experimentBaseline(new Set(), addDaysToDateString(today, 13), 28, today)).toMatchObject({ enough: false, later: addDaysToDateString(today, 14) });
  });
});
