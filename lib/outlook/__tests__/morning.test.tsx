import { act, render, renderHook, screen, waitFor } from '@testing-library/react-native';

import '@/lib/i18n';
import { GoodTomorrowCard } from '@/components/outlook/GoodTomorrowCard';
import type { Database } from '@/db';
import { createEntry, listMoods } from '@/db/repositories';
import { listTomorrowHints, listTomorrowSnapshots, markTomorrowHint } from '@/db/repositories/tomorrowHints';
import { tomorrowHints } from '@/db/schema';
import { createTestDb } from '@/db/testDb';
import { buildCatalog } from '@/lib/catalog/catalog';
import { addDaysToDateString, type DateString } from '@/lib/dates';
import { useDataVersion } from '@/lib/store/dataVersion';

import type { GoodTomorrow, TomorrowInput, TomorrowResult } from '../tomorrow';
import { parseStoredHint, resetTomorrow, useHintOnToday } from '../useGoodTomorrow';

/**
 * Which hint "Heute" shows, what is stored for the morning after, and how the morning card reads.
 * The backtest itself is covered in tomorrow.test.ts; here it finds a hint or not, as told.
 */
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => ({ ...require('react-native-reanimated/mock'), useReducedMotion: () => false }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('@expo/vector-icons/MaterialCommunityIcons', () => () => null);
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('expo-router', () => ({ router: { push: jest.fn(), navigate: jest.fn(), back: jest.fn() } }));
let mockDb: Database | null = null;
jest.mock('@/db/client', () => ({ getDb: () => mockDb, DATABASE_NAME: 'test.db' }));
/** Whether the backtest finds a hint, for the day after the one it is given. */
let mockFinds = true;
jest.mock('../tomorrow', () => ({
  ...jest.requireActual('../tomorrow'),
  // eslint-disable-next-line require-yield
  *tomorrowSteps(input: TomorrowInput): Generator<void, TomorrowResult> {
    const { addDaysToDateString: next } = jest.requireActual('@/lib/dates');
    return {
      status: { kind: 'ready', level: 4, proof: null, shown: 0 },
      hint: mockFinds ? { date: next(input.today, 1), level: 4, tier: 'top', proof: null, reasons: [] } : null,
    };
  },
}));

const today = '2026-09-26' as DateString;
const yesterday = addDaysToDateString(today, -1);
/** Yesterday's hint as it was on screen, with numbers the backtest here would never give. */
const evening: GoodTomorrow = { date: today, level: 4, tier: 'floor', proof: { hitRate: 0.93, usual: 0.85, cases: 40 }, reasons: [{ kind: 'mood' }] };

function diary(...dates: string[]): Database {
  const db = createTestDb();
  const mood = listMoods(db).find((m) => m.level === 4)!;
  for (const date of dates) createEntry(db, { date, time: '20:00', mood_id: mood.id });
  return db;
}

async function hintOn(db: Database, finds = true) {
  mockDb = db;
  mockFinds = finds;
  await act(async () => {
    resetTomorrow();
    useDataVersion.getState().bump();
  });
  const view = await renderHook(() => useHintOnToday(today, []));
  await waitFor(() => expect(view.result.current.hint !== null || !finds).toBe(true));
  return view.result;
}

describe('the hint on "Heute"', () => {
  it('is yesterday’s again in the morning, exactly as stored, while today is empty', async () => {
    const db = diary(yesterday);
    markTomorrowHint(db, yesterday, JSON.stringify(evening));
    const result = await hintOn(db);
    expect(result.current).toMatchObject({ morning: true, hint: evening });
    // It was counted yesterday; showing it again counts and stores nothing.
    await act(async () => result.current.markShown());
    expect(listTomorrowHints(db, yesterday)).toEqual([yesterday]);
  });

  it('is tomorrow’s once today has an entry, and marking stores it for the morning after', async () => {
    const db = diary(yesterday, today);
    markTomorrowHint(db, yesterday, JSON.stringify(evening));
    const result = await hintOn(db);
    expect(result.current).toMatchObject({ morning: false, hint: { date: addDaysToDateString(today, 1) } });
    await act(async () => result.current.markShown());
    expect(parseStoredHint(listTomorrowSnapshots(db, today).get(today))).toMatchObject({ date: addDaysToDateString(today, 1) });
  });

  it('has no morning for a day that counted but kept no hint', async () => {
    const db = diary(yesterday);
    db.insert(tomorrowHints).values({ date: yesterday }).run();
    expect((await hintOn(db)).current.morning).toBe(false);
  });

  it('forgets today’s stored hint once it no longer holds, but keeps the day counted', async () => {
    const db = diary(today);
    markTomorrowHint(db, today, JSON.stringify({ ...evening, date: addDaysToDateString(today, 1) }));
    await hintOn(db, false);
    await waitFor(() => expect(listTomorrowSnapshots(db, today).size).toBe(0));
    expect(listTomorrowHints(db, today)).toEqual([today]);
  });

  it('reads nothing but a stored hint back', () => {
    expect(parseStoredHint(JSON.stringify(evening))).toEqual(evening);
    expect(parseStoredHint('{"date":1}')).toBeNull();
    expect(parseStoredHint('kaputt')).toBeNull();
    expect(parseStoredHint(undefined)).toBeNull();
  });
});

describe('the morning card', () => {
  const catalog = buildCatalog({ moods: listMoods(createTestDb()), groups: [], activities: [], scales: [] });
  const hint = (proof: GoodTomorrow['proof']): GoodTomorrow => ({ date: today, level: 4, tier: 'top', proof, reasons: [{ kind: 'mood' }, { kind: 'weekday', weekday: 6 }] });

  it('looks back from today, with the numbers of the evening before', async () => {
    await render(<GoodTomorrowCard hint={hint({ hitRate: 0.93, usual: 0.85, cases: 40 })} catalog={catalog} morning />);
    expect(screen.getByText('Gute Aussichten für heute')).toBeTruthy();
    expect(screen.getByText(/^Nach Tagen wie gestern war der nächste Tag bei dir in 93 %/)).toBeTruthy();
    expect(screen.getByText('Gründe: deine Stimmung gestern, heute ist Samstag')).toBeTruthy();
    expect(screen.queryByText(/outlook\.|\{\{/)).toBeNull();
  });

  it('says it is still open without a backtest', async () => {
    await render(<GoodTomorrowCard hint={hint(null)} catalog={catalog} morning />);
    expect(screen.getByText(/^Auf Tage wie gestern folgte bei dir besonders oft/)).toBeTruthy();
  });
});
