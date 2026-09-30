import { listEntryDetails } from '@/db/repositories';
import { listPlannedActivities } from '@/db/repositories/plans';
import { createTestDb } from '@/db/testDb';
import type { DateString } from '@/lib/dates';
import { generateSample } from '@/lib/dev/generateSample';
import { applySample } from '@/lib/dev/sample';
import { buildDays } from '@/lib/insights';

import { backtest } from '../backtest';
import { buildOutlook } from '../outlook';
import { plansByDay } from '../plans';

const today = '2026-09-26' as DateString;

describe('outlook on the sample data', () => {
  const db = createTestDb();
  applySample(db, generateSample({ seed: 42, today }));
  const days = buildDays(listEntryDetails(db));
  const result = backtest(days);

  it('narrowly beats both comparisons, so the ranges show', () => {
    for (const h of result.horizons) {
      expect(h.beats).toBe(true);
      expect(h.model!).toBeLessThan(h.mode!);
    }
    const outlook = buildOutlook({ days, today, plans: plansByDay(listPlannedActivities(db)), backtest: result });
    if (outlook.status !== 'ready') throw new Error('expected an outlook');
    expect(outlook.days).toHaveLength(7);
    for (const day of outlook.days) {
      expect(day.range).not.toBeNull();
      expect(day.range!.low).toBeLessThanOrEqual(day.range!.expected);
      expect(day.range!.high).toBeGreaterThanOrEqual(day.range!.expected);
      expect(day.range!.reasons.length).toBeLessThanOrEqual(3);
    }
    expect(outlook.days.some((day) => day.planned.length > 0)).toBe(true);
    expect(JSON.stringify(outlook)).not.toContain('NaN');
  });
});
