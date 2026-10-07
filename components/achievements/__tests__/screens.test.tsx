import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import '@/lib/i18n';
import type { Database } from '@/db';
import { replaceHealthDays } from '@/db/repositories/health';
import { getSettings } from '@/db/repositories/settings';
import { createTestDb } from '@/db/testDb';
import { addDaysToDateString, type DateString } from '@/lib/dates';
import { generateSample } from '@/lib/dev/generateSample';
import { applySample } from '@/lib/dev/sample';
import { useDataVersion } from '@/lib/store/dataVersion';
import { useSettingsStore } from '@/lib/store/settingsStore';

import AchievementsScreen from '../../../app/(tabs)/achievements';
import HistoryScreen from '../../../app/more/history';
import { StarToast, TOAST_DELAY_MS } from '../StarToast';

/** Renders the achievements tab, the star message and the history page that moved under "Mehr", as the insight screen tests do. */
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
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

const BROKEN = /NaN|undefined|achievements\.|history\./;
/** Star thresholds and progress lines are hidden from the screen reader, which hears the card in one sentence. */
const ALL = { includeHiddenElements: true };

describe('achievements screen', () => {
  it('shows every achievement without stars on an empty diary', async () => {
    use(createTestDb());
    await render(<AchievementsScreen />);
    expect(screen.getByText('0/85')).toBeTruthy();
    expect(screen.getByText('Am Ball')).toBeTruthy();
    expect(screen.getAllByText('Braucht Gesundheitsdaten aus Health Connect', ALL)).toHaveLength(2);
    expect(screen.queryByText(BROKEN, ALL)).toBeNull();
  });

  it('renders the sample year with watch data', async () => {
    const db = createTestDb();
    applySample(db, generateSample({ today }));
    replaceHealthDays(
      db,
      addDaysToDateString(today, -29),
      today,
      Array.from({ length: 30 }, (_, i) => ({ date: addDaysToDateString(today, -i), steps: 6000, sleep_minutes: 430, resting_hr: null, exercise_minutes: null })),
    );
    use(db);
    await render(<AchievementsScreen />);
    expect(screen.queryByText('0/85')).toBeNull();
    expect(screen.getByText('Schlafprotokoll')).toBeTruthy();
    expect(screen.queryByText(BROKEN, ALL)).toBeNull();
  });
});

describe('history page', () => {
  it('lists the sample entries under its own title', async () => {
    const db = createTestDb();
    applySample(db, generateSample({ today }));
    use(db);
    await render(<HistoryScreen />);
    expect(screen.getByText('Verlauf')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Zurück' })).toBeTruthy();
    expect(screen.queryByText(BROKEN, ALL)).toBeNull();
  });
});

describe('star message', () => {
  beforeEach(() => {
    mockPath = '/';
    jest.useFakeTimers();
  });
  afterEach(() => jest.useRealTimers());

  function sampleDb() {
    const db = createTestDb();
    applySample(db, generateSample({ today }));
    return db;
  }

  it('says hello once to a diary that already holds stars and opens the achievements on a tap', async () => {
    const db = sampleDb();
    use(db);
    await render(<StarToast />);
    // It waits a moment before it flies in.
    expect(screen.queryByText('NEU IN DAYLIGHT')).toBeNull();
    await act(async () => jest.advanceTimersByTime(TOAST_DELAY_MS));
    expect(screen.getByText('NEU IN DAYLIGHT')).toBeTruthy();
    expect(screen.queryByText(BROKEN, ALL)).toBeNull();
    await act(async () => fireEvent.press(screen.getByText('Ansehen')));
    expect(router.navigate).toHaveBeenCalledWith('/achievements');
    expect(screen.queryByText('NEU IN DAYLIGHT')).toBeNull();
    expect(getSettings(db).achievements_seen).toContain('"days"');
  });

  it('announces new stars and puts itself away after a while', async () => {
    const db = createTestDb();
    use(db);
    await render(<StarToast />);
    // An empty diary is stored without a message.
    expect(getSettings(db).achievements_seen).not.toBeNull();
    expect(screen.queryByText(/STERN/)).toBeNull();
    applySample(db, generateSample({ today }));
    await act(async () => useDataVersion.getState().bump());
    await act(async () => jest.advanceTimersByTime(TOAST_DELAY_MS));
    expect(screen.getByText(/NEUE STERNE/)).toBeTruthy();
    await act(async () => jest.advanceTimersByTime(8000));
    expect(screen.queryByText(/NEUE STERNE/)).toBeNull();
  });

  it('stays away on the achievements tab and counts the stars as seen there', async () => {
    const db = sampleDb();
    mockPath = '/achievements';
    use(db);
    await render(<StarToast />);
    await act(async () => jest.advanceTimersByTime(TOAST_DELAY_MS));
    expect(screen.queryByText('NEU IN DAYLIGHT')).toBeNull();
    expect(getSettings(db).achievements_seen).not.toBeNull();
  });
});
