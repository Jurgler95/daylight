import { act, fireEvent, render, screen } from '@testing-library/react-native';

import '@/lib/i18n';
import type { Database } from '@/db';
import { createEntry, createTurningPoint, listMoods, listTurningPoints } from '@/db/repositories';
import { createTestDb } from '@/db/testDb';
import { addDaysToDateString, type DateString } from '@/lib/dates';
import { useDataVersion } from '@/lib/store/dataVersion';
import { useSettingsStore } from '@/lib/store/settingsStore';

import TurningPointDetailScreen from '../../../app/turning/[id]';
import TurningPointScreen from '../../../app/turning/new';
import HistoryScreen from '../../../app/more/history';
import { TurningDayCard } from '../TurningDayCard';

/** The setting screen, the comparison, the card on "Heute" and the list in "Verlauf", rendered on a small diary. */
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('react-native-keyboard-controller', () => {
  const { ScrollView } = require('react-native');
  return { KeyboardAwareScrollView: ScrollView };
});
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('@expo/vector-icons/MaterialCommunityIcons', () => () => null);
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), navigate: jest.fn(), back: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => mockParams,
  usePathname: () => '/',
}));
let mockDb: Database | null = null;
jest.mock('@/db/client', () => ({ getDb: () => mockDb, DATABASE_NAME: 'test.db' }));
jest.mock('@/lib/dates/useToday', () => ({ useToday: () => '2026-09-26' }));

const today = '2026-09-26' as DateString;
const turn = '2026-06-01' as DateString;
const BROKEN = /NaN|undefined|turning\.|history\./;

/** Sets one the way the app does, so every screen reads it. */
function setPoint(db: Database, title: string, note?: string) {
  const point = createTurningPoint(db, { date: turn, title, note });
  useDataVersion.getState().bump();
  return point;
}

function diary(): Database {
  const db = createTestDb();
  const moods = listMoods(db);
  for (let i = 0; i < 240; i++) {
    const date = addDaysToDateString('2026-02-01' as DateString, i);
    if (date > today) break;
    createEntry(db, { date, time: '20:00', mood_id: moods[date < turn ? 3 : 1]!.id });
  }
  mockDb = db;
  useDataVersion.getState().bump();
  useSettingsStore.getState().load();
  return db;
}

describe('setting a turning point', () => {
  it('asks for the name above the field and insists on it when held without one', async () => {
    diary();
    mockParams = { date: turn };
    await render(<TurningPointScreen />);
    expect(screen.getByText('Für 2026 sind noch 4 von 4 frei')).toBeTruthy();
    expect(screen.getByText('GIB DIESEM TAG EINEN NAMEN')).toBeTruthy();
    expect(screen.queryByText('Ohne Namen geht es nicht: Wie heißt dieser Tag?')).toBeNull();
    await act(async () => fireEvent(screen.getByLabelText('Wendepunkt setzen'), 'pressIn'));
    expect(screen.getByText('Ohne Namen geht es nicht: Wie heißt dieser Tag?')).toBeTruthy();
    expect(listTurningPoints(mockDb!)).toEqual([]);
    await act(async () => fireEvent.changeText(screen.getByLabelText('Name des Wendepunkts'), 'Umzug'));
    expect(screen.queryByText('Ohne Namen geht es nicht: Wie heißt dieser Tag?')).toBeNull();
    expect(screen.queryByText(BROKEN)).toBeNull();
  });

  it('sets the point on a full hold and forgets the comparison when the page is left early', async () => {
    // Real timers: fake ones would also hold back React's own scheduling of the unmount.
    const setSpy = jest.spyOn(global, 'setTimeout');
    const clearSpy = jest.spyOn(global, 'clearTimeout');
    try {
      diary();
      mockParams = { date: turn };
      const { unmount } = await render(<TurningPointScreen />);
      await act(async () => fireEvent.changeText(screen.getByLabelText('Name des Wendepunkts'), 'Umzug'));
      // The mocked animation finishes at once, so the press-in is the whole hold.
      await act(async () => fireEvent(screen.getByLabelText('Wendepunkt setzen'), 'pressIn'));
      expect(listTurningPoints(mockDb!).map((point) => point.title)).toEqual(['Umzug']);
      expect(screen.getByText('Wendepunkt gesetzt')).toBeTruthy();
      const linger = setSpy.mock.results.find((_, i) => setSpy.mock.calls[i]![1] === 2000)?.value;
      expect(linger).toBeDefined();
      await act(async () => unmount());
      expect(clearSpy).toHaveBeenCalledWith(linger);
      expect(require('expo-router').router.replace).not.toHaveBeenCalled();
    } finally {
      setSpy.mockRestore();
      clearSpy.mockRestore();
    }
  });

  it('refuses a day without an entry', async () => {
    diary();
    mockParams = { date: '2027-01-01' };
    await render(<TurningPointScreen />);
    expect(screen.getByText('Ein Wendepunkt braucht einen Tag mit Eintrag, heute oder früher.')).toBeTruthy();
  });

  it('edits one with a plain save button', async () => {
    const db = diary();
    const point = setPoint(db, 'Umzug');
    mockParams = { id: String(point.id) };
    await render(<TurningPointScreen />);
    await act(async () => fireEvent.changeText(screen.getByLabelText('Name des Wendepunkts'), 'Neue Stadt'));
    await act(async () => fireEvent.press(screen.getByText('Speichern')));
    expect(listTurningPoints(db)[0]!.title).toBe('Neue Stadt');
  });
});

describe('the comparison', () => {
  it('shows both sides with numbers and the honest notes', async () => {
    const db = diary();
    const point = setPoint(db, 'Umzug', 'Neue Stadt');
    mockParams = { id: String(point.id) };
    await render(<TurningPointDetailScreen />);
    expect(screen.getByText('Umzug')).toBeTruthy();
    expect(screen.getByText(/In den 90 Tagen danach lag deine Stimmung im Schnitt bei 4,0, in den 90 Tagen davor bei 2,0/)).toBeTruthy();
    expect(screen.getByText(/keine Ursache/)).toBeTruthy();
    expect(screen.queryByText(BROKEN)).toBeNull();
  });
});

describe('turning points elsewhere', () => {
  it('offers to mark a day and shows a set one on "Heute"', async () => {
    const db = diary();
    await render(<TurningDayCard date={turn} />);
    expect(screen.getByText('Als Wendepunkt markieren')).toBeTruthy();
    setPoint(db, 'Umzug');
    await render(<TurningDayCard date={turn} />);
    expect(screen.getByText('Umzug')).toBeTruthy();
  });

  it('lists them in "Verlauf" behind the chip', async () => {
    const db = diary();
    setPoint(db, 'Umzug');
    mockParams = { turning: '1' };
    await render(<HistoryScreen />);
    expect(screen.getByText('Umzug')).toBeTruthy();
    expect(screen.getByText('1 von 4')).toBeTruthy();
    expect(screen.queryByText(BROKEN)).toBeNull();
  });
});
