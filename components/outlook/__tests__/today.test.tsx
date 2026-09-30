import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import '@/lib/i18n';
import type { Database } from '@/db';
import { createEntry, listMoods, listPlannedActivities, updateSettings } from '@/db/repositories';
import { createTestDb } from '@/db/testDb';
import { addDaysToDateString, type DateString } from '@/lib/dates';
import { applyDaylioImport } from '@/lib/daylio/apply';
import { parseDaylioCsv } from '@/lib/daylio/parse';
import { generateSample } from '@/lib/dev/generateSample';
import { applySample } from '@/lib/dev/sample';
import { backtestIdle, resetBacktest } from '@/lib/outlook/useOutlook';
import { useDataVersion } from '@/lib/store/dataVersion';
import { useSelectedDayStore } from '@/lib/store/selectedDay';
import { useSettingsStore } from '@/lib/store/settingsStore';

import AboutScreen from '../../../app/more/about';
import LockSettingsScreen from '../../../app/more/lock';
import OutlookSettingsScreen from '../../../app/more/outlook';
import PrivacyScreen from '../../../app/more/privacy';
import RemindersScreen from '../../../app/more/reminders';
import TodayScreen from '../../../app/(tabs)/index';
import CalendarScreen from '../../../app/(tabs)/calendar';

/**
 * Renders "Heute" with the outlook, the plans of a future day, the low mood note and the new pages
 * under "Mehr" against an empty diary, the sample year and (when present) the real export. Catches
 * crashes, NaN and missing text keys; layout and touch are checked on the phone.
 */
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('@expo/vector-icons/MaterialCommunityIcons', () => () => null);
jest.mock('expo-router', () => ({ router: { push: jest.fn(), navigate: jest.fn(), back: jest.fn() }, useLocalSearchParams: () => ({}) }));
jest.mock('expo-local-authentication', () => ({ getEnrolledLevelAsync: async () => 1, SecurityLevel: { NONE: 0 }, authenticateAsync: async () => ({ success: true }) }));
jest.mock('expo-notifications', () => ({ setNotificationHandler: jest.fn(), getPermissionsAsync: async () => ({ granted: false }) }));
let mockDb: Database | null = null;
jest.mock('@/db/client', () => ({ getDb: () => mockDb, DATABASE_NAME: 'test.db' }));
jest.mock('@/lib/dates/useToday', () => ({ useToday: () => '2026-09-26' }));

const today = '2026-09-26' as DateString;
const FILE = path.join(__dirname, '..', '..', '..', 'private', 'daylio_export_2026_09_26.csv');
const BROKEN = /NaN|undefined|outlook\.|lookback\.|lowMood\.|backup\.|reminders\.|lock\.|privacy\.|about\./;

async function use(db: Database) {
  mockDb = db;
  // A screen of the previous step may still be mounted and re-renders on these.
  await act(async () => {
    resetBacktest();
    useDataVersion.getState().bump();
    useSettingsStore.getState().load();
    useSelectedDayStore.setState({ picked: null });
  });
}

/** The backtest takes a few hundred milliseconds alone and several seconds on a busy machine. */
const BACKTEST_WAIT = { timeout: 20_000 };
jest.setTimeout(60_000);

/** Renders and lets the backtest finish, so its state update lands inside act. */
async function show(element: React.ReactElement) {
  await render(element);
  await waitFor(() => expect(backtestIdle()).toBe(true), BACKTEST_WAIT);
}

describe('today with the outlook', () => {
  it('shows a future day of the sample year with its reasons and plans', async () => {
    const db = createTestDb();
    applySample(db, generateSample({ today }));
    await use(db);
    await show(<TodayScreen />);
    expect(screen.queryByText(BROKEN)).toBeNull();

    const tomorrow = screen.getAllByRole('button', { name: /^Sonntag, 27\. September/ })[0]!;
    await act(async () => fireEvent.press(tomorrow));
    expect(screen.getByText('AUSBLICK')).toBeTruthy();
    expect(screen.getByText('GEPLANT')).toBeTruthy();
    expect(screen.queryByText(BROKEN)).toBeNull();

    // Planning an activity writes at once.
    const before = listPlannedActivities(db, '2026-09-27', '2026-09-27').length;
    await act(async () => fireEvent.press(screen.getAllByRole('button', { name: /^Soziales/ })[0]!));
    await act(async () => fireEvent.press(screen.getByText('Familie')));
    expect(listPlannedActivities(db, '2026-09-27', '2026-09-27').length).toBe(before + 1);

    await show(<CalendarScreen />);
    expect(screen.queryByText(BROKEN)).toBeNull();
  });

  it('shows the quiet note after a long low stretch and hides it for two weeks', async () => {
    const db = createTestDb();
    const moods = listMoods(db);
    const low = moods.find((m) => m.level === 2)!;
    const good = moods.find((m) => m.level === 4)!;
    for (let i = 0; i < 40; i += 1) createEntry(db, { date: addDaysToDateString(today, -i), time: '20:30', mood_id: i < 8 ? low.id : good.id });
    await use(db);
    await show(<TodayScreen />);
    expect(screen.getByText('Reden hilft')).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Ausblenden' })));
    expect(screen.queryByText('Reden hilft')).toBeNull();
    expect(useSettingsStore.getState().settings?.low_mood_dismissed_on).toBe(today);
  });

  it('reminds of a backup after 60 days without one', async () => {
    const db = createTestDb();
    const good = listMoods(db).find((m) => m.level === 4)!;
    createEntry(db, { date: addDaysToDateString(today, -61), time: '20:30', mood_id: good.id });
    await use(db);
    await show(<TodayScreen />);
    expect(screen.getByText('Zeit für eine Sicherung')).toBeTruthy();
    updateSettings(db, { last_export_at: new Date().toISOString() });
    await use(db);
    await show(<TodayScreen />);
    expect(screen.queryByText('Zeit für eine Sicherung')).toBeNull();
  });

  (existsSync(FILE) ? it : it.skip)('steps back on the real export (private/)', async () => {
    const db = createTestDb();
    applyDaylioImport(db, parseDaylioCsv(readFileSync(FILE, 'utf8')), { mode: 'merge' });
    await use(db);
    await show(<OutlookSettingsScreen />);
    await waitFor(() => expect(screen.getByText('Bisherige Treffsicherheit')).toBeTruthy(), BACKTEST_WAIT);
    expect(screen.getByText('Immer Gut')).toBeTruthy();
    expect(screen.queryByText(BROKEN)).toBeNull();
  });
});

describe('pages under "Mehr"', () => {
  it('render without missing texts', async () => {
    await use(createTestDb());
    for (const Page of [OutlookSettingsScreen, RemindersScreen, LockSettingsScreen, PrivacyScreen, AboutScreen]) {
      await show(<Page />);
      expect(screen.queryByText(BROKEN)).toBeNull();
    }
    await show(<RemindersScreen />);
    expect(screen.getByText('Tägliche Erinnerung')).toBeTruthy();
    expect(screen.getByText('20:30')).toBeTruthy();
  });
});
