import type { DateString } from '@/lib/dates';

import { bucketValues, localDay, mergeReadings, planSync, sleepMinutesByDay, withinPause, type SyncPlanInput } from '../days';

const d = (value: string) => value as DateString;

describe('bucketValues', () => {
  it('keys each bucket by its local day and skips buckets without data', () => {
    const values = bucketValues(
      [
        { startTime: '2026-09-01T00:00', result: { COUNT_TOTAL: 8123, dataOrigins: ['com.sec.android.app.shealth'] } },
        // The library reports 0 for a day without any record; that is "no data", not "0 steps".
        { startTime: '2026-09-02T00:00', result: { COUNT_TOTAL: 0, dataOrigins: [] } },
        { startTime: '2026-09-03T00:00', result: { COUNT_TOTAL: 0, dataOrigins: ['com.sec.android.app.shealth'] } },
      ],
      (r) => r.COUNT_TOTAL as number,
    );
    expect([...values]).toEqual([
      ['2026-09-01', 8123],
      ['2026-09-03', 0],
    ]);
  });
});

describe('localDay', () => {
  it('uses the offset the device recorded', () => {
    expect(localDay('2026-09-01T22:30:00Z', 2 * 3600)).toBe('2026-09-02');
    expect(localDay('2026-09-01T22:30:00Z', 0)).toBe('2026-09-01');
  });
});

describe('sleepMinutesByDay', () => {
  const offset = { totalSeconds: 2 * 3600 };

  it('gives the night to the day it ends on and leaves awake stages out', () => {
    const minutes = sleepMinutesByDay([
      {
        startTime: '2026-09-01T21:00:00Z',
        endTime: '2026-09-02T05:00:00Z',
        endZoneOffset: offset,
        stages: [
          { startTime: '2026-09-01T21:00:00Z', endTime: '2026-09-02T01:00:00Z', stage: 4 },
          { startTime: '2026-09-02T01:00:00Z', endTime: '2026-09-02T01:30:00Z', stage: 1 },
          { startTime: '2026-09-02T01:30:00Z', endTime: '2026-09-02T05:00:00Z', stage: 5 },
        ],
      },
    ]);
    expect([...minutes]).toEqual([['2026-09-02', 450]]);
  });

  it('counts the whole session without stages and a night recorded twice only once', () => {
    const night = { startTime: '2026-09-01T22:00:00Z', endTime: '2026-09-02T05:00:00Z', endZoneOffset: offset };
    const phone = { startTime: '2026-09-01T21:30:00Z', endTime: '2026-09-02T04:00:00Z', endZoneOffset: offset };
    const nap = { startTime: '2026-09-02T12:00:00Z', endTime: '2026-09-02T12:30:00Z', endZoneOffset: offset };
    expect([...sleepMinutesByDay([night, phone, nap])]).toEqual([['2026-09-02', 7.5 * 60 + 30]]);
  });
});

describe('mergeReadings', () => {
  it('writes one row per day with any value, null for what is missing', () => {
    const rows = mergeReadings(d('2026-09-01'), d('2026-09-03'), {
      steps: new Map([[d('2026-09-01'), 4000.4]]),
      sleepMinutes: new Map([[d('2026-09-03'), 420]]),
      restingHr: new Map([[d('2026-09-01'), 57.6]]),
      exerciseMinutes: new Map(),
    });
    expect(rows).toEqual([
      { date: '2026-09-01', steps: 4000, sleep_minutes: null, resting_hr: 58, exercise_minutes: null },
      { date: '2026-09-03', steps: null, sleep_minutes: 420, resting_hr: null, exercise_minutes: null },
    ]);
  });
});

describe('planSync', () => {
  const input = (overrides: Partial<SyncPlanInput> = {}): SyncPlanInput => ({
    today: d('2026-09-27'),
    firstEntry: d('2026-06-10'),
    syncedFrom: null,
    lastSyncDay: null,
    ...overrides,
  });
  const spans = (windows: ReturnType<typeof planSync>) => windows.map((w) => `${w.from}..${w.to}${w.backfill ? ' b' : ''}`);

  it('reads the last week first, then month by month back to the first entry', () => {
    expect(spans(planSync(input()))).toEqual([
      '2026-09-21..2026-09-27',
      '2026-09-01..2026-09-20 b',
      '2026-08-01..2026-08-31 b',
      '2026-07-01..2026-07-31 b',
      '2026-06-10..2026-06-30 b',
    ]);
  });

  it('resumes the backfill where it stopped', () => {
    expect(spans(planSync(input({ syncedFrom: d('2026-08-01'), lastSyncDay: d('2026-09-27') })))).toEqual([
      '2026-09-21..2026-09-27',
      '2026-07-01..2026-07-31 b',
      '2026-06-10..2026-06-30 b',
    ]);
  });

  it('only refreshes the last week once the backfill is done', () => {
    expect(spans(planSync(input({ syncedFrom: d('2026-06-10'), lastSyncDay: d('2026-09-27') })))).toEqual(['2026-09-21..2026-09-27']);
    // Last synced yesterday: the week before that is read again as well.
    expect(spans(planSync(input({ syncedFrom: d('2026-06-10'), lastSyncDay: d('2026-09-26') })))).toEqual(['2026-09-20..2026-09-27']);
  });

  it('reaches back to the last sync after a long break', () => {
    expect(spans(planSync(input({ syncedFrom: d('2026-06-10'), lastSyncDay: d('2026-08-20') })))).toEqual([
      '2026-09-01..2026-09-27',
      '2026-08-14..2026-08-31',
    ]);
  });

  it('backfills 30 days without any entry, and further once older entries arrive', () => {
    expect(spans(planSync(input({ firstEntry: null })))).toEqual([
      '2026-09-21..2026-09-27',
      '2026-09-01..2026-09-20 b',
      '2026-08-29..2026-08-31 b',
    ]);
    expect(spans(planSync(input({ firstEntry: d('2026-08-15'), syncedFrom: d('2026-08-29'), lastSyncDay: d('2026-09-27') })))).toEqual([
      '2026-09-21..2026-09-27',
      '2026-08-15..2026-08-28 b',
    ]);
  });
});

describe('withinPause', () => {
  const now = new Date('2026-09-27T10:00:00Z');
  it('holds for 15 minutes after the last sync', () => {
    expect(withinPause(null, now)).toBe(false);
    expect(withinPause('2026-09-27T09:50:00Z', now)).toBe(true);
    expect(withinPause('2026-09-27T09:44:00Z', now)).toBe(false);
    // A clock set back must not stop syncing for good.
    expect(withinPause('2026-09-28T09:50:00Z', now)).toBe(false);
  });
});
