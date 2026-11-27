import { act, fireEvent, render, screen } from '@testing-library/react-native';

import '@/lib/i18n';
import type { Database } from '@/db';
import { createTestDb } from '@/db/testDb';
import { useDataVersion } from '@/lib/store/dataVersion';
import { useSettingsStore } from '@/lib/store/settingsStore';

import RemindersScreen from '../../../app/more/reminders';

/** The list of times on the reminder settings: add, change, remove, and the hint for a time twice. */
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => ({ ...require('react-native-reanimated/mock'), useReducedMotion: () => false }));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('@expo/vector-icons/MaterialCommunityIcons', () => () => null);
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), navigate: jest.fn(), back: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => ({}),
  usePathname: () => '/more/reminders',
}));
let mockDb: Database | null = null;
jest.mock('@/db/client', () => ({ getDb: () => mockDb, DATABASE_NAME: 'test.db' }));
jest.mock('@/lib/notifications/client', () => ({
  ...jest.requireActual('@/lib/notifications/client'),
  notificationsAvailable: () => true,
  requestPermission: () => Promise.resolve(true),
}));
/** The inline picker (the test runs as iOS): the last one shown, so a test can pick a time in it. */
let mockPick: ((time: string) => void) | null = null;
jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  DateTimePickerAndroid: { open: jest.fn() },
  default: ({ onChange }: { onChange: (event: unknown, date?: Date) => void }) => {
    mockPick = (time: string) => onChange({}, new Date(2000, 0, 1, Number(time.slice(0, 2)), Number(time.slice(3))));
    return null;
  },
}));

const settings = () => useSettingsStore.getState().settings!;
const HINT = 'Diese Uhrzeit gibt es schon.';

async function pick(button: string, time: string) {
  mockPick = null;
  await act(async () => fireEvent.press(screen.getByRole('button', { name: button })));
  await act(async () => mockPick!(time));
  // Close the inline picker again, so the next one opened is the one a test picks in.
  await act(async () => fireEvent.press(screen.getByRole('button', { name: button })));
}

describe('reminder settings, times of the daily reminder', () => {
  beforeEach(() => {
    mockDb = createTestDb();
    useDataVersion.getState().bump();
    useSettingsStore.getState().load();
    useSettingsStore.getState().update({ reminder_enabled: true, reminder_times: ['09:00', '20:30'] });
  });

  it('lists the times in order, each to change and to remove', async () => {
    await render(<RemindersScreen />);
    expect(screen.getByRole('button', { name: 'Uhrzeit 09:00 ändern' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Uhrzeit 20:30 ändern' })).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Uhrzeit 09:00 entfernen' })));
    expect(settings()).toMatchObject({ reminder_times: ['20:30'], reminder_time: '20:30' });
    // The last one cannot be removed.
    expect(screen.queryByRole('button', { name: 'Uhrzeit 20:30 entfernen' })).toBeNull();
  });

  it('adds a time and keeps the list sorted', async () => {
    await render(<RemindersScreen />);
    await pick('Uhrzeit hinzufügen', '14:15');
    expect(settings()).toMatchObject({ reminder_times: ['09:00', '14:15', '20:30'], reminder_time: '20:30' });
    expect(screen.queryByText(HINT)).toBeNull();
  });

  it('refuses a time that is already there with a short hint, which goes with the next change that works', async () => {
    await render(<RemindersScreen />);
    await pick('Uhrzeit hinzufügen', '20:30');
    expect(screen.getByText(HINT)).toBeTruthy();
    expect(settings().reminder_times).toEqual(['09:00', '20:30']);
    await pick('Uhrzeit hinzufügen', '12:00');
    expect(screen.queryByText(HINT)).toBeNull();
    expect(settings().reminder_times).toEqual(['09:00', '12:00', '20:30']);
  });

  it('refuses to move a time onto another one of the list', async () => {
    await render(<RemindersScreen />);
    await pick('Uhrzeit 09:00 ändern', '20:30');
    expect(screen.getByText(HINT)).toBeTruthy();
    expect(settings().reminder_times).toEqual(['09:00', '20:30']);
  });
});
