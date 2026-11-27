import type { DateString } from '@/lib/dates';

import { outlookContradicts } from '../agree';
import type { Outlook, OutlookRange } from '../outlook';
import type { GoodTomorrow } from '../tomorrow';

const tomorrow = '2026-09-27' as DateString;
const hint: GoodTomorrow = { date: tomorrow, level: 4, tier: 'top', proof: null, reasons: [] };

function outlook(range: Partial<OutlookRange> | null, date: DateString = tomorrow): Outlook {
  const full = range && { expected: 4, low: 3.5, high: 4.5, mid: 4, lowLevel: 4, highLevel: 5, hardChance: null, confidence: 0.5, reasons: [], ...range };
  const day = { date, horizon: 1, weekday: 0, range: full, planned: [], recurring: [], weekdayMean: 4, weekdayDays: 10 };
  return { status: 'ready', days: [day], backtest: { horizons: [] }, shownHorizons: [1] } as unknown as Outlook;
}

describe('outlookContradicts', () => {
  it('sees a contradiction in a named hard day or a range that stays below good', () => {
    expect(outlookContradicts(hint, outlook({ hardChance: 0.2 }))).toBe(true);
    expect(outlookContradicts(hint, outlook({ mid: 3, highLevel: 3 }))).toBe(true);
  });

  it('sees none where the range reaches good, or where there is no range for the day', () => {
    expect(outlookContradicts(hint, outlook({}))).toBe(false);
    expect(outlookContradicts(hint, outlook({ mid: 3, lowLevel: 2, highLevel: 4 }))).toBe(false);
    expect(outlookContradicts(hint, outlook(null))).toBe(false);
    expect(outlookContradicts(hint, outlook({ hardChance: 0.5 }, '2026-09-28' as DateString))).toBe(false);
    expect(outlookContradicts(hint, { status: 'tooFew', days: 10, needed: 30 })).toBe(false);
  });
});
