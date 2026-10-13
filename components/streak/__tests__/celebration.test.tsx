import { act, fireEvent, render, screen } from '@testing-library/react-native';

import '@/lib/i18n';
import type { Database } from '@/db';
import { createTestDb } from '@/db/testDb';
import type { DateString } from '@/lib/dates';
import { generateSample } from '@/lib/dev/generateSample';
import { applySample } from '@/lib/dev/sample';
import { useDataVersion } from '@/lib/store/dataVersion';
import { useOverlayStore } from '@/lib/store/overlays';
import { useSettingsStore } from '@/lib/store/settingsStore';

import { StarToast, TOAST_DELAY_MS } from '../../achievements/StarToast';
import { CELEBRATION_DELAY_MS, StreakCelebration } from '../StreakCelebration';

/** The banner and the overlay after a save, and their turn with the star message. */
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => ({ ...require('react-native-reanimated/mock'), useReducedMotion: () => false }));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('@expo/vector-icons/MaterialCommunityIcons', () => () => null);
let mockPath = '/';
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), navigate: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => ({}),
  usePathname: () => mockPath,
}));
let mockDb: Database | null = null;
jest.mock('@/db/client', () => ({ getDb: () => mockDb, DATABASE_NAME: 'test.db' }));
jest.mock('@/lib/dates/useToday', () => ({ useToday: () => '2026-09-26' }));

const today = '2026-09-26' as DateString;

function use(db: Database) {
  mockDb = db;
  useDataVersion.getState().bump();
  useSettingsStore.getState().load();
}

const wait = (ms: number) => act(async () => jest.advanceTimersByTime(ms));

describe('streak celebration', () => {
  beforeEach(() => {
    mockPath = '/';
    jest.useFakeTimers();
    useOverlayStore.setState({ waiting: [], celebration: null, chipPulse: null });
    use(createTestDb());
  });
  afterEach(() => jest.useRealTimers());

  it('slides a banner in for 50 days once the editor is closed', async () => {
    mockPath = '/entry/new';
    useOverlayStore.getState().celebrate({ milestone: 'large', rescued: true, days: 50 });
    const view = await render(<StreakCelebration />);
    await wait(CELEBRATION_DELAY_MS);
    expect(screen.queryByText('50 Tage in Folge')).toBeNull();
    mockPath = '/';
    await view.rerender(<StreakCelebration />);
    await wait(CELEBRATION_DELAY_MS);
    expect(screen.getByText('50 Tage in Folge')).toBeTruthy();
    expect(screen.getByText('Serie gerettet')).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Schließen' })));
    expect(screen.queryByText('50 Tage in Folge')).toBeNull();
    expect(useOverlayStore.getState().celebration).toBeNull();
  });

  it('says the streak was saved when a gap is closed without a milestone', async () => {
    useOverlayStore.getState().celebrate({ milestone: null, rescued: true, days: 6 });
    await render(<StreakCelebration />);
    await wait(CELEBRATION_DELAY_MS);
    expect(screen.getByText('Serie gerettet: 6 Tage')).toBeTruthy();
  });

  it('takes the screen every 200 days', async () => {
    useOverlayStore.getState().celebrate({ milestone: 'huge', rescued: false, days: 200 });
    await render(<StreakCelebration />);
    await wait(CELEBRATION_DELAY_MS);
    expect(screen.getByText('200')).toBeTruthy();
    expect(screen.getByText('Tage in Folge')).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Schließen' })));
    expect(screen.queryByText('200')).toBeNull();
  });

  it('lets the star message wait until the celebration is put away', async () => {
    const db = createTestDb();
    applySample(db, generateSample({ today }));
    use(db);
    useOverlayStore.getState().celebrate({ milestone: 'large', rescued: false, days: 100 });
    await render(
      <>
        <StreakCelebration />
        <StarToast />
      </>,
    );
    await wait(Math.max(CELEBRATION_DELAY_MS, TOAST_DELAY_MS));
    expect(screen.getByText('100 Tage in Folge')).toBeTruthy();
    expect(screen.queryByText('NEU IN DAYLIGHT')).toBeNull();
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Schließen' })));
    await wait(TOAST_DELAY_MS);
    expect(screen.getByText('NEU IN DAYLIGHT')).toBeTruthy();
  });
});
