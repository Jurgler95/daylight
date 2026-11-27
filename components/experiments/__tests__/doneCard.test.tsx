import { act, fireEvent, render, screen } from '@testing-library/react-native';

import '@/lib/i18n';
import type { Database } from '@/db';
import { createExperiment, getExperiment, setExperimentDays } from '@/db/repositories';
import { createTestDb } from '@/db/testDb';
import type { DateString } from '@/lib/dates';
import { useDataVersion } from '@/lib/store/dataVersion';

import { ExperimentDoneCard } from '../ExperimentDoneCard';

/** The card on "Heute" once an experiment is over. */
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('@expo/vector-icons/MaterialCommunityIcons', () => () => null);
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
let mockDb: Database | null = null;
jest.mock('@/db/client', () => ({ getDb: () => mockDb, DATABASE_NAME: 'test.db' }));

const today = '2026-09-26' as DateString;
let db: Database;

/** Created on `createdOn`, as if the app was used back then. */
function add(title: string, start: string, days: number, createdOn: string, checkIn = false) {
  const created = createExperiment(db, { title, start_date: start, days, check_in: checkIn }, createdOn as DateString);
  useDataVersion.getState().bump();
  return created;
}

beforeEach(() => {
  jest.clearAllMocks();
  db = createTestDb();
  mockDb = db;
  useDataVersion.getState().bump();
});

describe('the card on "Heute"', () => {
  it('points to the comparison once an experiment is over', async () => {
    const done = add('Kein Kaffee', '2026-08-26', 28, '2026-08-26');
    await render(<ExperimentDoneCard today={today} />);
    expect(screen.getByText('„Kein Kaffee“ ist vorbei')).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByText('Vergleich ansehen')));
    expect(jest.requireMock('expo-router').router.push).toHaveBeenCalledWith({ pathname: '/experiments/[id]', params: { id: String(done.id) } });
  });

  it('stays away for one that was already over when it was created', async () => {
    add('Kein Kaffee', '2026-08-26', 28, today);
    await render(<ExperimentDoneCard today={today} />);
    expect(screen.queryByText(/ist vorbei/)).toBeNull();
  });

  it('shows only one card, for the one that ended last, and goes away when closed', async () => {
    const older = add('Früh schlafen', '2026-08-20', 28, '2026-08-20');
    const newer = add('Kein Kaffee', '2026-08-26', 28, '2026-08-26');
    await render(<ExperimentDoneCard today={today} />);
    expect(screen.getAllByText(/ist vorbei/)).toHaveLength(1);
    expect(screen.getByText('„Kein Kaffee“ ist vorbei')).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByText('Schließen')));
    expect(getExperiment(db, newer.id)!.result_seen).toBe(true);
    expect(screen.getByText('„Früh schlafen“ ist vorbei')).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByText('Schließen')));
    expect(getExperiment(db, older.id)!.result_seen).toBe(true);
    expect(screen.queryByText(/ist vorbei/)).toBeNull();
  });

  it('shows up right away for one a "no" ended on its start day', async () => {
    const fresh = add('Kein Kaffee', today, 28, today, true);
    setExperimentDays(db, today, { [fresh.id]: false }, today);
    useDataVersion.getState().bump();
    await render(<ExperimentDoneCard today={today} />);
    expect(screen.getByText('„Kein Kaffee“ ist vorbei')).toBeTruthy();
  });
});
