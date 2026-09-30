import { countRows } from '@/db/repositories/maintenance';
import { createTestDb } from '@/db/testDb';
import type { DateString } from '@/lib/dates';
import { parseDaylioCsv } from '@/lib/daylio/parse';
import { readDaylioRows } from '@/lib/daylio/rows';
import { writeDaylioCsv } from '@/lib/daylio/write';

import { generateSample } from '../generateSample';
import { applySample } from '../sample';

const today = '2026-09-26' as DateString;

describe('sample data', () => {
  const data = generateSample({ today });

  it('is deterministic', () => {
    expect(generateSample({ today })).toEqual(data);
    expect(generateSample({ today, seed: 7 })).not.toEqual(data);
  });

  it('looks like a year of Daylio entries', () => {
    const days = new Set(data.entries.map((entry) => entry.date));
    expect(days.size).toBeGreaterThan(330);
    expect(days.size).toBeLessThan(365);
    expect(data.entries.length).toBeGreaterThan(days.size);
    expect([...days].every((day) => day < today)).toBe(true);
    const good = data.entries.filter((entry) => entry.mood === 'Gut').length / data.entries.length;
    expect(good).toBeGreaterThan(0.4);
    expect(new Set(data.entries.map((entry) => entry.mood)).size).toBeGreaterThanOrEqual(4);
    expect(data.entries.some((entry) => entry.note?.includes('"'))).toBe(true);
    expect(data.entries.some((entry) => entry.note?.includes('\n'))).toBe(true);
    expect(data.plans.every((plan) => plan.date > today)).toBe(true);
  });

  it('loads into an empty database with plans and a scale', () => {
    const db = createTestDb();
    applySample(db, data);
    const counts = countRows(db);
    expect(counts.entries).toBe(data.entries.length);
    expect(counts.scales).toBe(1);
    expect(counts.planned).toBe(data.plans.length);
    expect(counts.moods).toBe(5);
  });

  it('survives a Daylio CSV round trip byte for byte', () => {
    const db = createTestDb();
    applySample(db, data);
    const csv = writeDaylioCsv(readDaylioRows(db));
    const parsed = parseDaylioCsv(csv);
    expect(parsed.errors).toEqual([]);

    const again = createTestDb();
    applySample(again, { entries: parsed.entries, plans: [] });
    expect(writeDaylioCsv(readDaylioRows(again))).toBe(csv);
  });
});
