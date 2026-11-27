import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import '@/lib/i18n';
import type { Database } from '@/db';
import { createExperiment } from '@/db/repositories';
import { createTestDb } from '@/db/testDb';
import type { DateString } from '@/lib/dates';
import { useDataVersion } from '@/lib/store/dataVersion';

import { ExperimentStartRow, ExperimentTodayCard, useOffersExperimentStart } from '../ExperimentTodayCard';

/** The running self-experiment on "Heute", and the quiet way to start one. */
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('@expo/vector-icons/MaterialCommunityIcons', () => () => null);
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
let mockDb: Database | null = null;
jest.mock('@/db/client', () => ({ getDb: () => mockDb, DATABASE_NAME: 'test.db' }));

const today = '2026-09-26' as DateString;
let db: Database;

function add(title: string, start: string, days: number) {
  const created = createExperiment(db, { title, start_date: start, days }, start as DateString);
  useDataVersion.getState().bump();
  return created;
}

function Offer() {
  return <Text>{useOffersExperimentStart(today) ? 'offer' : 'none'}</Text>;
}

beforeEach(() => {
  jest.clearAllMocks();
  db = createTestDb();
  mockDb = db;
  useDataVersion.getState().bump();
});

describe('a self-experiment on "Heute"', () => {
  it('shows the running one with its day and opens the interim comparison', async () => {
    const running = add('Kein Kaffee', '2026-09-22', 14);
    await render(<ExperimentTodayCard today={today} />);
    expect(screen.getByText('SELBSTVERSUCH')).toBeTruthy();
    expect(screen.getByText('Tag 5 von 14')).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByLabelText('Selbstversuch Kein Kaffee, Tag 5 von 14, Zwischenstand ansehen')));
    expect(jest.requireMock('expo-router').router.push).toHaveBeenCalledWith({ pathname: '/experiments/[id]', params: { id: String(running.id) } });
  });

  it('shows nothing and offers a start while none runs or is planned', async () => {
    add('Früh schlafen', '2026-08-01', 14);
    await render(
      <>
        <ExperimentTodayCard today={today} />
        <Offer />
      </>,
    );
    expect(screen.queryByText('SELBSTVERSUCH')).toBeNull();
    expect(screen.getByText('offer')).toBeTruthy();
  });

  it('offers no start while one is planned', async () => {
    add('Früh schlafen', '2026-10-05', 14);
    await render(<Offer />);
    expect(screen.getByText('none')).toBeTruthy();
  });

  it('opens the form from the start row', async () => {
    await render(<ExperimentStartRow />);
    await act(async () => fireEvent.press(screen.getByText('Selbstversuch starten')));
    expect(jest.requireMock('expo-router').router.push).toHaveBeenCalledWith('/experiments/new');
  });
});
