import { act, fireEvent, render, screen } from '@testing-library/react-native';

import '@/lib/i18n';
import type { Database } from '@/db';
import { createTestDb } from '@/db/testDb';
import { useDataVersion } from '@/lib/store/dataVersion';
import { useOverlayStore } from '@/lib/store/overlays';
import { useSettingsStore } from '@/lib/store/settingsStore';

import { DENIED_HINT_MS, PROMPT_DELAY_MS, ReminderPrompt } from '../ReminderPrompt';

/** The start sheet that offers the reminder once. */
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
let mockAvailable = true;
const mockRequest = jest.fn<Promise<boolean>, [string]>();
jest.mock('@/lib/notifications/client', () => ({
  ...jest.requireActual('@/lib/notifications/client'),
  notificationsAvailable: () => mockAvailable,
  requestPermission: (name: string) => mockRequest(name),
}));

const TITLE = 'Abends kurz erinnern?';
const wait = (ms: number) => act(async () => jest.advanceTimersByTime(ms));
const settings = () => useSettingsStore.getState().settings!;

describe('reminder start sheet', () => {
  beforeEach(() => {
    mockPath = '/';
    mockAvailable = true;
    mockRequest.mockReset();
    jest.useFakeTimers();
    useOverlayStore.setState({ waiting: [], celebration: null, chipPulse: null });
    mockDb = createTestDb();
    useDataVersion.getState().bump();
    useSettingsStore.getState().load();
  });
  afterEach(() => jest.useRealTimers());

  it('comes up on "Heute" and holds the slot, so the star message waits', async () => {
    await render(<ReminderPrompt />);
    expect(useOverlayStore.getState().waiting).toContain('reminderPrompt');
    expect(screen.queryByText(TITLE)).toBeNull();
    await wait(PROMPT_DELAY_MS);
    expect(screen.getByText(TITLE)).toBeTruthy();
    expect(screen.getByText('Fehlt ein Tag, erinnere ich dich am nächsten Morgen.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Uhrzeit am Abend, 20:30' })).toBeTruthy();
  });

  it('"Später" closes it for good and leaves the reminder off', async () => {
    await render(<ReminderPrompt />);
    await wait(PROMPT_DELAY_MS);
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Später' })));
    expect(screen.queryByText(TITLE)).toBeNull();
    expect(settings()).toMatchObject({ reminder_prompt_done: true, reminder_enabled: false });
    expect(useOverlayStore.getState().waiting).not.toContain('reminderPrompt');
  });

  it('"Erinnern" switches both reminders on once the permission is granted', async () => {
    mockRequest.mockResolvedValue(true);
    useSettingsStore.getState().update({ reminder_yesterday_enabled: false });
    await render(<ReminderPrompt />);
    await wait(PROMPT_DELAY_MS);
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Erinnern' })));
    expect(mockRequest).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(TITLE)).toBeNull();
    expect(settings()).toMatchObject({ reminder_enabled: true, reminder_time: '20:30', reminder_yesterday_enabled: true, reminder_prompt_done: true });
  });

  it('shows where to switch it on after a refusal, then closes and never asks again', async () => {
    mockRequest.mockResolvedValue(false);
    await render(<ReminderPrompt />);
    await wait(PROMPT_DELAY_MS);
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Erinnern' })));
    expect(screen.getByText('Du kannst sie jederzeit unter Mehr › Erinnerung einschalten.')).toBeTruthy();
    expect(settings()).toMatchObject({ reminder_enabled: false, reminder_prompt_done: true });
    await wait(DENIED_HINT_MS);
    expect(screen.queryByText(TITLE)).toBeNull();
    expect(useOverlayStore.getState().waiting).not.toContain('reminderPrompt');
  });

  it('waits while another screen is open, e.g. an import', async () => {
    mockPath = '/more/import';
    await render(<ReminderPrompt />);
    await wait(PROMPT_DELAY_MS);
    expect(screen.queryByText(TITLE)).toBeNull();
    expect(useOverlayStore.getState().waiting).toEqual([]);
  });

  it('stays away without reminders and without counting as answered', async () => {
    mockAvailable = false;
    await render(<ReminderPrompt />);
    await wait(PROMPT_DELAY_MS);
    expect(screen.queryByText(TITLE)).toBeNull();
    expect(settings().reminder_prompt_done).toBe(false);
  });

  it('never shows to whoever has the reminder on', async () => {
    useSettingsStore.getState().update({ reminder_enabled: true });
    await render(<ReminderPrompt />);
    await wait(PROMPT_DELAY_MS);
    expect(screen.queryByText(TITLE)).toBeNull();
  });
});
