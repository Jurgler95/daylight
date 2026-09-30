import { firstEntryDate } from '@/db/repositories/entries';
import { countHealthDays, listHealthDays, type HealthDayInput } from '@/db/repositories/health';
import { getSettings, updateSettings } from '@/db/repositories/settings';
import { createTestDb } from '@/db/testDb';
import { addDaysToDateString, type DateString } from '@/lib/dates';

import { syncHealth, type HealthSource } from '../sync';

/** A Health Connect with 5,000 steps on every day, recording which windows were read. */
function fakeSource(options: { failFrom?: string; granted?: string[] } = {}) {
  const reads: string[] = [];
  const source: HealthSource = {
    granted: async () => new Set(options.granted ?? ['Steps']),
    read: async (from, to) => {
      reads.push(`${from}..${to}`);
      if (options.failFrom && from <= options.failFrom) throw new Error('Health Connect nicht erreichbar');
      const days: HealthDayInput[] = [];
      for (let day = from; day <= to; day = addDaysToDateString(day, 1)) {
        days.push({ date: day, steps: 5000, sleep_minutes: null, resting_hr: null, exercise_minutes: null });
      }
      return days;
    },
  };
  return { source, reads };
}

const now = new Date('2026-09-27T10:00:00');

describe('syncHealth', () => {
  it('does nothing while switched off', async () => {
    const db = createTestDb();
    const { source, reads } = fakeSource();
    expect(await syncHealth({ db, source, now })).toBe('off');
    expect(reads).toEqual([]);
  });

  it('reads the last week and 30 days back on the first run, then pauses', async () => {
    const db = createTestDb();
    expect(firstEntryDate(db)).toBeNull();
    updateSettings(db, { health_enabled: true });
    const { source, reads } = fakeSource();

    expect(await syncHealth({ db, source, now })).toBe('done');
    expect(reads).toEqual(['2026-09-21..2026-09-27', '2026-09-01..2026-09-20', '2026-08-29..2026-08-31']);
    expect(countHealthDays(db)).toBe(30);
    expect(getSettings(db)).toMatchObject({ health_synced_from: '2026-08-29', health_last_error: null });

    expect(await syncHealth({ db, source, now: new Date('2026-09-27T10:05:00') })).toBe('paused');
    expect(await syncHealth({ db, source, now: new Date('2026-09-27T10:05:00'), force: true })).toBe('done');
    expect(reads.slice(3)).toEqual(['2026-09-21..2026-09-27']);
  });

  it('keeps what was saved when a later month fails, notes the error and resumes there', async () => {
    const db = createTestDb();
    updateSettings(db, { health_enabled: true });
    const failing = fakeSource({ failFrom: '2026-08-31' });

    expect(await syncHealth({ db, source: failing.source, now })).toBe('failed');
    expect(listHealthDays(db).map((day) => day.date)[0]).toBe('2026-09-01');
    expect(getSettings(db)).toMatchObject({ health_synced_from: '2026-09-01', health_last_sync_at: null, health_last_error: 'Health Connect nicht erreichbar' });

    const working = fakeSource();
    expect(await syncHealth({ db, source: working.source, now })).toBe('done');
    expect(working.reads).toEqual(['2026-09-21..2026-09-27', '2026-08-29..2026-08-31']);
    expect(getSettings(db).health_last_error).toBeNull();
  });

  it('stops after the current month once switched off', async () => {
    const db = createTestDb();
    updateSettings(db, { health_enabled: true });
    const { source, reads } = fakeSource();
    let windows = 0;
    const outcome = await syncHealth({ db, source, now, onWindow: () => (windows += 1), stillEnabled: () => windows < 1 });
    expect(outcome).toBe('stopped');
    expect(reads).toEqual(['2026-09-21..2026-09-27']);
  });

  it('says so when nothing was allowed', async () => {
    const db = createTestDb();
    updateSettings(db, { health_enabled: true });
    const { source, reads } = fakeSource({ granted: [] });
    expect(await syncHealth({ db, source, now })).toBe('nothing-allowed');
    expect(reads).toEqual([]);
  });
});

describe('health days', () => {
  it('a sync replaces its days and drops the ones Health Connect no longer has', async () => {
    const db = createTestDb();
    updateSettings(db, { health_enabled: true });
    await syncHealth({ db, source: fakeSource().source, now });
    const empty: HealthSource = { granted: async () => new Set(['Steps']), read: async () => [] };
    await syncHealth({ db, source: empty, now, force: true });
    const dates = listHealthDays(db).map((day) => day.date as DateString);
    expect(dates.some((date) => date >= '2026-09-21')).toBe(false);
    expect(dates).toContain('2026-09-20');
  });
});
