import type { MoodLevel } from '@/db/schema';
import type { DateString } from '@/lib/dates';

import { dayAccessibilityLabel, type DayMarker } from '../dayLabel';

const NAMES: Record<MoodLevel, string> = { 5: 'Super', 4: 'Gut', 3: 'Ok', 2: 'Schlecht', 1: 'Mies' };

const texts = {
  today: 'Heute',
  mood: (level: MoodLevel) => NAMES[level],
  entries: (count: number) => `${count} Einträge`,
  noEntry: 'kein Eintrag',
  formatDate: (date: DateString) => date,
  outlook: (level: MoodLevel) => `Ausblick ${NAMES[level]}`,
  planned: (names: string) => `geplant: ${names}`,
  turning: 'Wendepunkt',
};

const date = '2026-03-14' as DateString;
const marker = (overrides: Partial<DayMarker> = {}): DayMarker => ({ level: 4, icon: 'emoticon-happy-outline', count: 1, ...overrides });

describe('dayAccessibilityLabel', () => {
  it('says that a past day has no entry', () => {
    expect(dayAccessibilityLabel(date, undefined, false, false, texts)).toBe('2026-03-14, kein Eintrag');
  });

  it('reads the bare date for an empty future day', () => {
    expect(dayAccessibilityLabel(date, undefined, false, true, texts)).toBe('2026-03-14');
  });

  it('marks today before the mood', () => {
    expect(dayAccessibilityLabel(date, marker(), true, false, texts)).toBe('2026-03-14, Heute, Gut');
  });

  it('names the count only when there are several entries', () => {
    expect(dayAccessibilityLabel(date, marker({ level: 3, count: 2 }), false, false, texts)).toBe('2026-03-14, Ok, 2 Einträge');
  });

  it('names a turning point after the entries', () => {
    expect(dayAccessibilityLabel(date, marker({ count: 2, turning: true }), false, false, texts)).toBe('2026-03-14, Gut, 2 Einträge, Wendepunkt');
  });

  it('marks today without an entry', () => {
    expect(dayAccessibilityLabel(date, undefined, true, false, texts)).toBe('2026-03-14, Heute, kein Eintrag');
  });

  it('names the outlook and the plans of a future day', () => {
    const ahead = { outlook: { level: 5 as MoodLevel, icon: 'emoticon-excited-outline' as const }, planned: [{ icon: 'account-group-outline' as const, name: 'Familie' }, { icon: 'airplane' as const, name: 'Reisen' }] };
    expect(dayAccessibilityLabel(date, ahead, false, true, texts)).toBe('2026-03-14, Ausblick Super, geplant: Familie, Reisen');
    expect(dayAccessibilityLabel(date, { outlook: null, planned: [ahead.planned[0]!] }, false, true, texts)).toBe('2026-03-14, geplant: Familie');
  });
});
