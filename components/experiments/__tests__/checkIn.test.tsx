import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';

import '@/lib/i18n';
import { EntryEditor } from '@/components/entry/EntryEditor';
import type { Database } from '@/db';
import { createEntry, createExperiment, getExperiment, listEntries, listExperimentDays, listMoods, setExperimentDays } from '@/db/repositories';
import { createTestDb } from '@/db/testDb';
import type { DateString } from '@/lib/dates';
import type { EditorTarget } from '@/lib/entry/useEntryEditor';
import { useDataVersion } from '@/lib/store/dataVersion';
import { useSettingsStore } from '@/lib/store/settingsStore';

import ExperimentDetailScreen from '../../../app/experiments/[id]';

/** "Kept today?" in the entry editor and how often it was kept on the comparison page. */
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('react-native-keyboard-controller', () => {
  const { ScrollView } = require('react-native');
  return { KeyboardAwareScrollView: ScrollView };
});
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('@expo/vector-icons/MaterialCommunityIcons', () => () => null);
jest.mock('@react-native-community/datetimepicker', () => ({ __esModule: true, DateTimePickerAndroid: { open: jest.fn() }, default: () => null }));
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), navigate: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => mockParams,
  usePathname: () => '/',
  useNavigation: () => ({ isFocused: () => true, dispatch: jest.fn() }),
}));
let mockDirty = false;
jest.mock('expo-router/react-navigation', () => ({
  usePreventRemove: (dirty: boolean) => {
    mockDirty = dirty;
  },
}));
let mockDb: Database | null = null;
jest.mock('@/db/client', () => ({ getDb: () => mockDb, DATABASE_NAME: 'test.db' }));
jest.mock('@/lib/dates/useToday', () => ({ useToday: () => '2026-09-26' }));

const today = '2026-09-26' as DateString;
let db: Database;
let mood: number;

function experiment(title: string, start: string, checkIn = true, days = 28) {
  const created = createExperiment(db, { title, start_date: start, days, check_in: checkIn }, today);
  useDataVersion.getState().bump();
  return created;
}

const newOn = (date: string): EditorTarget => ({ kind: 'new', date: date as DateString, moodId: mood });

async function pressAlertButton(spy: jest.SpyInstance, label: string) {
  const buttons = spy.mock.calls.at(-1)![2] as { text: string; onPress?: () => void }[];
  await act(async () => buttons.find((button) => button.text === label)!.onPress?.());
}

const answers = (id: number) => listExperimentDays(db, id).map((row) => [row.date, row.kept]);

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  mockDirty = false;
  db = createTestDb();
  mockDb = db;
  mood = listMoods(db)[1]!.id;
  useDataVersion.getState().bump();
  useSettingsStore.getState().load();
});

describe('the question in the entry editor', () => {
  it('asks only for running experiments with the question on, and not for a day after today', async () => {
    experiment('Kein Kaffee', '2026-09-15');
    experiment('Ohne Frage', '2026-09-15', false);
    experiment('Später', '2026-10-01');
    experiment('Vorbei', '2026-08-01', true, 14);
    const view = await render(<EntryEditor target={newOn('2026-09-20')} />);
    expect(screen.getByText('Kein Kaffee: eingehalten?')).toBeTruthy();
    expect(screen.queryByText(/Ohne Frage|Später|Vorbei/)).toBeNull();
    await act(async () => view.unmount());

    await render(<EntryEditor target={newOn('2026-09-14')} />);
    expect(screen.queryByText(/eingehalten\?/)).toBeNull();
  });

  it('writes the answer with "Speichern" and shows it in a second entry of the day', async () => {
    const running = experiment('Kein Kaffee', '2026-09-15');
    const first = await render(<EntryEditor target={newOn('2026-09-20')} />);
    await act(async () => fireEvent.press(screen.getByText('Ja')));
    expect(mockDirty).toBe(true);
    expect(answers(running.id)).toEqual([]);
    await act(async () => fireEvent.press(screen.getByText('Speichern')));
    expect(answers(running.id)).toEqual([['2026-09-20', true]]);
    await act(async () => first.unmount());

    await render(<EntryEditor target={newOn('2026-09-20')} />);
    expect(screen.getByLabelText('Ja').props.accessibilityState).toMatchObject({ selected: true });
    expect(mockDirty).toBe(false);
  });

  it('takes an answer back with a second tap', async () => {
    const running = experiment('Kein Kaffee', '2026-09-15');
    setExperimentDays(db, '2026-09-20', { [running.id]: true }, today);
    const entry = createEntry(db, { date: '2026-09-20', time: '20:00', mood_id: mood });
    useDataVersion.getState().bump();
    await render(<EntryEditor target={{ kind: 'edit', id: entry.id }} />);
    await act(async () => fireEvent.press(screen.getByText('Ja')));
    expect(screen.getByLabelText('Ja').props.accessibilityState).toMatchObject({ selected: false });
    expect(mockDirty).toBe(true);
    await act(async () => fireEvent.press(screen.getByText('Speichern')));
    expect(answers(running.id)).toEqual([]);
  });

  it('asks before a "no", and cancelling leaves the day open', async () => {
    const running = experiment('Kein Kaffee', '2026-09-15');
    const alert = jest.spyOn(Alert, 'alert');
    await render(<EntryEditor target={newOn('2026-09-20')} />);
    await act(async () => fireEvent.press(screen.getByText('Nein')));
    expect(alert).toHaveBeenLastCalledWith('Experiment beenden?', expect.stringContaining('Dann endet „Kein Kaffee“ am'), expect.any(Array));
    expect(alert.mock.calls.at(-1)![1]).toContain('19. September');
    await pressAlertButton(alert, 'Abbrechen');
    expect(screen.getByLabelText('Nein').props.accessibilityState).toMatchObject({ selected: false });
    expect(mockDirty).toBe(false);
    await act(async () => fireEvent.press(screen.getByText('Speichern')));
    expect(getExperiment(db, running.id)!.end_date).toBe('2026-10-12');
    expect(answers(running.id)).toEqual([]);
  });

  it('ends the experiment the day before once a confirmed "no" is saved, and drops later answers', async () => {
    const running = experiment('Kein Kaffee', '2026-09-15');
    setExperimentDays(db, '2026-09-16', { [running.id]: true }, today);
    setExperimentDays(db, '2026-09-22', { [running.id]: true }, today);
    useDataVersion.getState().bump();
    const alert = jest.spyOn(Alert, 'alert');
    await render(<EntryEditor target={newOn('2026-09-20')} />);
    await act(async () => fireEvent.press(screen.getByText('Nein')));
    await pressAlertButton(alert, 'Beenden');
    expect(screen.getByText(/Mit dem Speichern endet das Experiment am/)).toBeTruthy();
    // Nothing happens before "Speichern".
    expect(getExperiment(db, running.id)!.end_date).toBe('2026-10-12');
    await act(async () => fireEvent.press(screen.getByText('Speichern')));
    expect(getExperiment(db, running.id)!.end_date).toBe('2026-09-19');
    expect(answers(running.id)).toEqual([
      ['2026-09-16', true],
      ['2026-09-20', false],
    ]);
  });

  it('ends it on the start day after a "no" there', async () => {
    const fresh = experiment('Kein Kaffee', today);
    const alert = jest.spyOn(Alert, 'alert');
    await render(<EntryEditor target={newOn(today)} />);
    await act(async () => fireEvent.press(screen.getByText('Nein')));
    expect(alert.mock.calls.at(-1)![1]).toContain('26. September');
    await pressAlertButton(alert, 'Beenden');
    await act(async () => fireEvent.press(screen.getByText('Speichern')));
    expect(getExperiment(db, fresh.id)!.end_date).toBe(today);
    expect(answers(fresh.id)).toEqual([[today, false]]);
  });

  it('changes nothing when the editor is left without saving', async () => {
    const running = experiment('Kein Kaffee', '2026-09-15');
    const alert = jest.spyOn(Alert, 'alert');
    const view = await render(<EntryEditor target={newOn('2026-09-20')} />);
    await act(async () => fireEvent.press(screen.getByText('Nein')));
    await pressAlertButton(alert, 'Beenden');
    expect(mockDirty).toBe(true);
    await act(async () => view.unmount());
    expect(getExperiment(db, running.id)!.end_date).toBe('2026-10-12');
    expect(answers(running.id)).toEqual([]);
    expect(listEntries(db)).toEqual([]);
  });
});

describe('the answers on the comparison page', () => {
  it('counts the days kept and says when a "no" ended it', async () => {
    const running = experiment('Kein Kaffee', '2026-09-15');
    setExperimentDays(db, '2026-09-16', { [running.id]: true }, today);
    setExperimentDays(db, '2026-09-17', { [running.id]: true }, today);
    setExperimentDays(db, '2026-09-20', { [running.id]: false }, today);
    useDataVersion.getState().bump();
    mockParams = { id: String(running.id) };
    await render(<ExperimentDetailScreen />);
    expect(screen.getByText('Eingehalten an 2 von 3 Tagen mit Antwort.')).toBeTruthy();
    expect(screen.getByText(/^Beendet durch ein Nein am .*20\. September/)).toBeTruthy();
  });

  it('says when there is no answer yet, and stays away without the question', async () => {
    const asking = experiment('Kein Kaffee', '2026-09-15');
    const silent = experiment('Ohne Frage', '2026-09-15', false);
    mockParams = { id: String(asking.id) };
    const view = await render(<ExperimentDetailScreen />);
    expect(screen.getByText(/^Noch keine Antwort/)).toBeTruthy();
    await act(async () => view.unmount());
    mockParams = { id: String(silent.id) };
    await render(<ExperimentDetailScreen />);
    expect(screen.queryByText('Eingehalten')).toBeNull();
  });
});
