import { listEntryDetails } from '@/db/repositories';
import { createTestDb } from '@/db/testDb';
import type { DateString } from '@/lib/dates';
import { generateSample } from '@/lib/dev/generateSample';
import { applySample } from '@/lib/dev/sample';

import { INSIGHT_RANGES } from '../range';
import { buildInsights } from '../overview';

const today = '2026-09-26' as DateString;
// JSON turns NaN and Infinity into null, so they get a marker the assertions can find.
const json = (value: unknown) =>
  JSON.stringify(value, (_key, v: unknown) => (v instanceof Set ? [...v] : typeof v === 'number' && !Number.isFinite(v) ? 'NaN' : v));

describe('buildInsights', () => {
  it('runs on an empty diary without NaN and with empty cards', () => {
    for (const range of INSIGHT_RANGES) {
      const insights = buildInsights({ entries: [], range, today, firstDayOfWeek: 1 });
      expect(json(insights)).not.toContain('NaN');
      expect(insights).toMatchObject({
        days: [],
        mean: null,
        series: [],
        months: [],
        counts: [],
        pairs: [],
        coverage: null,
        years: [],
        streaks: { longest: null, current: null },
        usual: null,
        effects: { lifts: [], lowers: [] },
        beforeHard: { hardDays: 0, items: [] },
      });
    }
  });

  it('runs on the sample year and finds what the generator put in', () => {
    const db = createTestDb();
    applySample(db, generateSample({ today }));
    const entries = listEntryDetails(db);
    for (const range of INSIGHT_RANGES) {
      const insights = buildInsights({ entries, range, today, firstDayOfWeek: 1 });
      expect(json(insights)).not.toContain('NaN');
      expect(insights.series.length).toBeGreaterThan(20);
    }
    const year = buildInsights({ entries, range: '365', today, firstDayOfWeek: 1 });
    // Mostly "Gut" with days around it: a usual range, and months that count their days against it.
    expect(year.usual).toEqual({ lo: expect.any(Number), hi: expect.any(Number) });
    expect(year.months.length).toBeGreaterThan(10);
    for (const month of year.months) expect(month.usual!.below + month.usual!.within + month.usual!.above).toBe(month.days);
    expect(year.months.some((month) => month.usual!.below > 0)).toBe(true);
    expect(year.months.some((month) => month.usual!.above > 0)).toBe(true);
    // Two entries on some days: more entries than days.
    expect(year.coverage!.entries).toBeGreaterThan(year.coverage!.days);
    expect(year.weekdays.weekdays.every((w) => w.days > 40)).toBe(true);
  });
});
