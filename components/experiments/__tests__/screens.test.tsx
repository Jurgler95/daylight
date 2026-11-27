import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';

import '@/lib/i18n';
import type { Database } from '@/db';
import { createEntry, createExperiment, endExperiment, getExperiment, listExperiments, listMoods } from '@/db/repositories';
import { createTestDb } from '@/db/testDb';
import { addDaysToDateString, type DateString } from '@/lib/dates';
import { buildExport } from '@/lib/export';
import { readImportFile, usePendingImport } from '@/lib/export/pending';
import { useDataVersion } from '@/lib/store/dataVersion';
import { useSettingsStore } from '@/lib/store/settingsStore';

import ExperimentDetailScreen from '../../../app/experiments/[id]';
import ExperimentsScreen from '../../../app/experiments/index';
import ExperimentFormScreen from '../../../app/experiments/new';
import ImportScreen from '../../../app/more/import';
import { ExperimentsCard } from '../ExperimentsCard';

/** The list, the form, the comparison, the card on "Einblicke" and the loss in the import preview, on a small diary. */
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
jest.mock('expo-router/react-navigation', () => ({ usePreventRemove: () => undefined }));
let mockDb: Database | null = null;
jest.mock('@/db/client', () => ({ getDb: () => mockDb, DATABASE_NAME: 'test.db' }));
jest.mock('@/lib/dates/useToday', () => ({ useToday: () => '2026-09-26' }));

const today = '2026-09-26' as DateString;
const BROKEN = /NaN|undefined|experiments\./;

/**
 * One entry a day from `from` to today. Before and after the window the mood wanders between 2 and
 * 4 in a fixed pattern; inside `high` it is 5.
 */
function diary(from: string, high?: { from: string; to: string }): Database {
  const db = createTestDb();
  const moods = listMoods(db);
  for (let i = 0; ; i++) {
    const date = addDaysToDateString(from as DateString, i);
    if (date > today) break;
    const level = high && date >= high.from && date <= high.to ? 5 : 2 + ((i * 7) % 3);
    createEntry(db, { date, time: '20:00', mood_id: moods[5 - level]!.id });
  }
  mockDb = db;
  useDataVersion.getState().bump();
  useSettingsStore.getState().load();
  return db;
}

function add(db: Database, title: string, start: string, days = 28, createdOn: DateString = today) {
  const experiment = createExperiment(db, { title, start_date: start, days }, createdOn);
  useDataVersion.getState().bump();
  return experiment;
}

async function pressAlertButton(spy: jest.SpyInstance, label: string) {
  const buttons = spy.mock.calls.at(-1)![2] as { text: string; onPress?: () => void }[];
  await act(async () => buttons.find((button) => button.text === label)!.onPress!());
}

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
});

describe('the list', () => {
  it('explains what an experiment is while there is none', async () => {
    diary('2026-09-01');
    await render(<ExperimentsScreen />);
    expect(screen.getByText(/nimmst du dir für ein paar Wochen etwas vor/)).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByText('Neues Experiment')));
    expect(jest.requireMock('expo-router').router.push).toHaveBeenCalledWith('/experiments/new');
  });

  it('groups them into running, planned and over', async () => {
    const db = diary('2026-09-01');
    add(db, 'Kein Kaffee', '2026-09-10');
    add(db, 'Abendspaziergang', '2026-10-05');
    add(db, 'Früh schlafen', '2026-08-01', 14);
    await render(<ExperimentsScreen />);
    expect(screen.getByText('LÄUFT')).toBeTruthy();
    expect(screen.getByText('GEPLANT')).toBeTruthy();
    expect(screen.getByText('VORBEI')).toBeTruthy();
    expect(screen.getByText('Tag 17 von 28')).toBeTruthy();
    expect(screen.getByText('Lief 14 Tage')).toBeTruthy();
    expect(screen.getByText(/^Beginnt am/)).toBeTruthy();
    expect(screen.queryByText(BROKEN)).toBeNull();
  });
});

describe('the form', () => {
  it('insists on a title and then creates the experiment', async () => {
    const db = diary('2026-09-01');
    await render(<ExperimentFormScreen />);
    await act(async () => fireEvent.press(screen.getByText('Experiment anlegen')));
    expect(screen.getByText('Gib dem Experiment einen Namen (höchstens 60 Zeichen).')).toBeTruthy();
    expect(listExperiments(db)).toEqual([]);
    await act(async () => fireEvent.changeText(screen.getByLabelText('Was probierst du?'), '  Kein Kaffee nach 14 Uhr '));
    expect(screen.queryByText('Gib dem Experiment einen Namen (höchstens 60 Zeichen).')).toBeNull();
    await act(async () => fireEvent.press(screen.getByText('Experiment anlegen')));
    const [created] = listExperiments(db);
    expect(created).toMatchObject({ title: 'Kein Kaffee nach 14 Uhr', start_date: today, end_date: '2026-10-23', check_in: false });
    expect(jest.requireMock('expo-router').router.replace).toHaveBeenCalledWith({ pathname: '/experiments/[id]', params: { id: String(created!.id) } });
  });

  it('takes a length in weeks and the daily question', async () => {
    const db = diary('2026-09-01');
    await render(<ExperimentFormScreen />);
    await act(async () => fireEvent.changeText(screen.getByLabelText('Was probierst du?'), 'Abendspaziergang'));
    await act(async () => fireEvent.press(screen.getByLabelText('Dauer: 4 Wochen')));
    await act(async () => fireEvent.press(screen.getByText('2 Wochen')));
    await act(async () => fireEvent(screen.getByRole('switch'), 'valueChange', true));
    await act(async () => fireEvent.press(screen.getByText('Experiment anlegen')));
    expect(listExperiments(db)[0]).toMatchObject({ end_date: '2026-10-09', check_in: true });
  });

  it('refuses a length that would end before today while editing', async () => {
    const db = diary('2026-09-01');
    const running = add(db, 'Kein Kaffee', '2026-09-10');
    mockParams = { id: String(running.id) };
    await render(<ExperimentFormScreen />);
    await act(async () => fireEvent.press(screen.getByLabelText('Dauer: 4 Wochen')));
    await act(async () => fireEvent.press(screen.getByText('2 Wochen')));
    await act(async () => fireEvent.press(screen.getByText('Speichern')));
    expect(screen.getByText(/Mit dieser Dauer läge das Ende vor heute/)).toBeTruthy();
    expect(getExperiment(db, running.id)!.end_date).toBe('2026-10-07');
    await act(async () => fireEvent.press(screen.getByLabelText('Dauer: 2 Wochen')));
    await act(async () => fireEvent.press(screen.getByText('6 Wochen')));
    await act(async () => fireEvent.press(screen.getByText('Speichern')));
    expect(getExperiment(db, running.id)!.end_date).toBe('2026-10-21');
    expect(jest.requireMock('expo-router').router.back).toHaveBeenCalledTimes(1);
  });

  it('keeps start and length of one that is over', async () => {
    const db = diary('2026-09-01');
    const over = add(db, 'Früh schlafen', '2026-08-01', 14);
    mockParams = { id: String(over.id) };
    await render(<ExperimentFormScreen />);
    expect(screen.queryByLabelText(/^Dauer/)).toBeNull();
    expect(screen.getByText(/Nach dem Ende bleiben Beginn und Dauer/)).toBeTruthy();
    await act(async () => fireEvent.changeText(screen.getByLabelText('Was probierst du?'), 'Früher schlafen'));
    await act(async () => fireEvent.press(screen.getByText('Speichern')));
    expect(getExperiment(db, over.id)).toMatchObject({ title: 'Früher schlafen', end_date: '2026-08-14' });
  });
});

describe('the comparison', () => {
  it('says when there are too few days', async () => {
    const db = diary('2026-09-15');
    const running = add(db, 'Kein Kaffee', '2026-09-20');
    mockParams = { id: String(running.id) };
    await render(<ExperimentDetailScreen />);
    expect(screen.getByText(/Noch zu wenige Tage zum Vergleichen/)).toBeTruthy();
    expect(screen.queryByText(BROKEN)).toBeNull();
  });

  it('says that one ended after a few days never gets a comparison', async () => {
    const db = diary('2026-06-01');
    const short = add(db, 'Kein Kaffee', '2026-09-20');
    endExperiment(db, short.id, '2026-09-23' as DateString);
    useDataVersion.getState().bump();
    mockParams = { id: String(short.id) };
    await render(<ExperimentDetailScreen />);
    expect(screen.getByText('Das Experiment lief nur 3 Tage. Für einen Vergleich braucht es mindestens 7 Tage.')).toBeTruthy();
  });

  it('shows the interim numbers without a verdict while it runs, and ends it on request', async () => {
    const db = diary('2026-01-01');
    const running = add(db, 'Kein Kaffee', '2026-09-10');
    mockParams = { id: String(running.id) };
    await render(<ExperimentDetailScreen />);
    expect(screen.getByText(/^Zwischenstand nach 17 von 28 Tagen: Im Experiment lag deine Stimmung/)).toBeTruthy();
    expect(screen.getByText(/zeigt Daylight am Ende/)).toBeTruthy();
    expect(screen.queryByText(/Stichtage/)).toBeNull();
    expect(screen.getByText(/es zeigt keine Ursache/)).toBeTruthy();
    expect(screen.queryByText(BROKEN)).toBeNull();

    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await act(async () => fireEvent.press(screen.getByText('Jetzt beenden')));
    await pressAlertButton(alert, 'Beenden');
    expect(getExperiment(db, running.id)!.end_date).toBe('2026-09-25');
    alert.mockRestore();
  });

  it('judges the difference once it is over and marks the result seen', async () => {
    const db = diary('2025-09-27', { from: '2026-08-01', to: '2026-08-28' });
    // Created while it still ran, so the result is not seen yet.
    const over = add(db, 'Kein Kaffee', '2026-08-01', 28, '2026-08-10' as DateString);
    expect(over.result_seen).toBe(false);
    mockParams = { id: String(over.id) };
    await render(<ExperimentDetailScreen />);
    expect(screen.getByText(/^Im Experiment lag deine Stimmung im Schnitt bei 5,0, in den 28 Tagen davor bei/)).toBeTruthy();
    expect(screen.getByText(/kam in deiner Vorgeschichte nur an .* der Stichtage zwischen zwei gleich langen Zeiträumen vor/)).toBeTruthy();
    expect(screen.queryByText(/Vorläufig/)).toBeNull();
    expect(screen.queryByText(/Zwischenstand/)).toBeNull();
    expect(screen.getByText(/es zeigt keine Ursache/)).toBeTruthy();
    expect(screen.queryByText('Jetzt beenden')).toBeNull();
    expect(screen.queryByText(BROKEN)).toBeNull();
    expect(getExperiment(db, over.id)!.result_seen).toBe(true);
  });

  it('says when the history before it is too short to judge', async () => {
    const db = diary('2026-06-20', { from: '2026-08-01', to: '2026-08-28' });
    const over = add(db, 'Kein Kaffee', '2026-08-01');
    mockParams = { id: String(over.id) };
    await render(<ExperimentDetailScreen />);
    expect(screen.getByText('Für einen Vergleich mit deinen üblichen Schwankungen reicht die Zeit vor dem Experiment noch nicht.')).toBeTruthy();
    expect(screen.queryByText(BROKEN)).toBeNull();
  });

  it('deletes one after asking', async () => {
    const db = diary('2026-09-01');
    const planned = add(db, 'Abendspaziergang', '2026-10-05');
    mockParams = { id: String(planned.id) };
    await render(<ExperimentDetailScreen />);
    expect(screen.getByText(/^Es beginnt am/)).toBeTruthy();
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await act(async () => fireEvent.press(screen.getByText('Experiment löschen')));
    await pressAlertButton(alert, 'Experiment löschen');
    expect(listExperiments(db)).toEqual([]);
    alert.mockRestore();
  });
});

describe('experiments elsewhere', () => {
  it('invites on "Einblicke" and then shows the running ones', async () => {
    const db = diary('2026-09-01');
    await render(<ExperimentsCard today={today} />);
    expect(screen.getByText(/Nimm dir etwas für ein paar Wochen vor/)).toBeTruthy();
    await act(async () => void add(db, 'Kein Kaffee', '2026-09-10'));
    await render(<ExperimentsCard today={today} />);
    expect(screen.getByText('Kein Kaffee')).toBeTruthy();
    expect(screen.getByText('Tag 17 von 28')).toBeTruthy();
  });

  it('warns in the import preview that a replace loses the experiments', async () => {
    const source = diary('2026-09-20');
    const file = readImportFile('backup.json', JSON.stringify(buildExport(source, '1')));
    const db = diary('2026-09-01');
    add(db, 'Kein Kaffee', '2026-09-10');
    add(db, 'Abendspaziergang', '2026-10-05');
    usePendingImport.getState().set(file);
    await render(<ImportScreen />);
    expect(screen.queryByText('2 Experimente gehen verloren.')).toBeNull();
    await act(async () => fireEvent.press(screen.getByText('Ersetzen')));
    expect(screen.getByText('2 Experimente gehen verloren.')).toBeTruthy();
    await act(async () => usePendingImport.getState().set(null));
  });
});
