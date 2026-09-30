import type { MoodLevel } from '@/db/schema';
import type { DateString } from '@/lib/dates';
import type { IconName } from '@/lib/icons';

import { buildAheadMarkers, buildDayMarkers, sameMarker, type MarkerEntry } from '../markers';

const d = (s: string) => s as DateString;
const ICONS: Record<number, IconName> = { 1: 'emoticon-excited-outline', 2: 'emoticon-happy-outline', 9: 'coffee' };
const LEVEL_ICONS: Record<MoodLevel, IconName> = {
  5: 'emoticon-excited-outline',
  4: 'emoticon-happy-outline',
  3: 'emoticon-neutral-outline',
  2: 'emoticon-sad-outline',
  1: 'emoticon-cry-outline',
};
const entry = (date: string, time: string, level: number, mood_id: number): MarkerEntry => ({ date: d(date), time, level, mood_id });
const build = (entries: MarkerEntry[]) =>
  buildDayMarkers(
    entries,
    (id) => ICONS[id],
    (level) => LEVEL_ICONS[level],
  );

describe('buildDayMarkers', () => {
  it('leaves days without entries out', () => {
    expect(build([]).size).toBe(0);
  });

  it('draws a single entry with its own mood icon', () => {
    expect(build([entry('2026-09-01', '20:00', 4, 9)]).get(d('2026-09-01'))).toEqual({ level: 4, icon: 'coffee', count: 1 });
  });

  it('takes the latest entry on the rounded level', () => {
    const markers = build([entry('2026-09-01', '08:00', 4, 2), entry('2026-09-01', '21:00', 4, 9), entry('2026-09-01', '12:00', 3, 1)]);
    // (4 + 4 + 3) / 3 = 3.67, rounds to 4; the later of the two level-4 entries wins.
    expect(markers.get(d('2026-09-01'))).toEqual({ level: 4, icon: 'coffee', count: 3 });
  });

  it('falls back to the icon of the level when no entry sits on it', () => {
    const markers = build([entry('2026-09-01', '08:00', 2, 2), entry('2026-09-01', '21:00', 5, 1)]);
    // (2 + 5) / 2 = 3.5, rounds to 4, but neither entry is a 4.
    expect(markers.get(d('2026-09-01'))).toEqual({ level: 4, icon: 'emoticon-happy-outline', count: 2 });
  });
});

describe('buildAheadMarkers', () => {
  const activity = (id: number) => (id === 7 ? { icon: 'account-group-outline' as IconName, name: 'Familie' } : undefined);

  it('marks future days with plans, an outlook or both, and skips unknown activities', () => {
    const plans = new Map([
      [d('2026-10-01'), [7, 99]],
      [d('2026-10-02'), [99]],
    ]);
    const outlook = new Map([[d('2026-10-03'), { level: 5 as MoodLevel, icon: LEVEL_ICONS[5] }]]);
    const markers = buildAheadMarkers(plans, outlook, activity);
    expect(markers.get(d('2026-10-01'))).toEqual({ outlook: null, planned: [{ icon: 'account-group-outline', name: 'Familie' }] });
    expect(markers.has(d('2026-10-02'))).toBe(false);
    expect(markers.get(d('2026-10-03'))).toEqual({ outlook: { level: 5, icon: LEVEL_ICONS[5] }, planned: [] });
  });

  it('compares ahead markers by content, and never equal to a day marker', () => {
    const a = { outlook: { level: 4 as MoodLevel, icon: LEVEL_ICONS[4] }, planned: [{ icon: 'coffee' as IconName, name: 'Kaffee' }] };
    expect(sameMarker(a, { ...a, planned: [...a.planned] })).toBe(true);
    expect(sameMarker(a, { ...a, outlook: null })).toBe(false);
    expect(sameMarker(a, { level: 4, icon: LEVEL_ICONS[4], count: 1 })).toBe(false);
  });
});
