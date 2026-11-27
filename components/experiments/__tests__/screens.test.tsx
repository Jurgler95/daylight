import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';

import '@/lib/i18n';
import type { Database } from '@/db';
import { createEntry, createExperiment, createScale, endExperiment, getExperiment, listExperimentDays, listExperiments, listMoods, setExperimentDays } from '@/db/repositories';
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
/** The inline picker's props on iOS, to pick a day in a test. */
let mockPickerProps: { onChange: (event: unknown, picked?: Date) => void } | null = null;
jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  DateTimePickerAndroid: { open: jest.fn() },
  default: (props: { onChange: (event: unknown, picked?: Date) => void }) => {
    mockPickerProps = props;
    return null;
  },
}));
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

/** Picks a start day through the row, on whichever platform the tests run. */
async function pickStart(current: RegExp, day: Date) {
  mockPickerProps = null;
  await act(async () => fireEvent.press(screen.getByLabelText(current)));
  const open = jest.requireMock('@react-native-community/datetimepicker').DateTimePickerAndroid.open as jest.Mock;
  const android = open.mock.calls.at(-1)?.[0] as { onChange: (event: { type: string }, picked?: Date) => void } | undefined;
  await act(async () => (android ? android.onChange({ type: 'set' }, day) : mockPickerProps!.onChange({}, day)));
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
    await act(async () => fireEvent.press(screen.getByText('Neuer Selbstversuch')));
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
    await act(async () => fireEvent.press(screen.getByText('Selbstversuch anlegen')));
    expect(screen.getByText('Gib dem Selbstversuch einen Namen (höchstens 60 Zeichen).')).toBeTruthy();
    expect(listExperiments(db)).toEqual([]);
    expect(screen.getByLabelText('Was probierst du?').props.maxLength).toBe(60);
    await act(async () => fireEvent.changeText(screen.getByLabelText('Was probierst du?'), '  Kein Kaffee nach 14 Uhr '));
    expect(screen.queryByText('Gib dem Selbstversuch einen Namen (höchstens 60 Zeichen).')).toBeNull();
    await act(async () => fireEvent.press(screen.getByText('Selbstversuch anlegen')));
    const [created] = listExperiments(db);
    expect(created).toMatchObject({ title: 'Kein Kaffee nach 14 Uhr', start_date: today, end_date: '2026-10-23', check_in: false });
    expect(jest.requireMock('expo-router').router.replace).toHaveBeenCalledWith({ pathname: '/experiments/[id]', params: { id: String(created!.id) } });
  });

  it('refuses a second experiment with the same name and start', async () => {
    const db = diary('2026-09-01');
    add(db, 'Kein Kaffee', today);
    await render(<ExperimentFormScreen />);
    await act(async () => fireEvent.changeText(screen.getByLabelText('Was probierst du?'), 'kein kaffee'));
    await act(async () => fireEvent.press(screen.getByText('Selbstversuch anlegen')));
    expect(screen.getByText('Einen Selbstversuch mit diesem Namen und diesem Beginn gibt es schon.')).toBeTruthy();
    expect(listExperiments(db)).toHaveLength(1);
  });

  it('takes a length in weeks and the daily question', async () => {
    const db = diary('2026-09-01');
    await render(<ExperimentFormScreen />);
    await act(async () => fireEvent.changeText(screen.getByLabelText('Was probierst du?'), 'Abendspaziergang'));
    await act(async () => fireEvent.press(screen.getByLabelText('Dauer: 4 Wochen')));
    await act(async () => fireEvent.press(screen.getByText('2 Wochen')));
    await act(async () => fireEvent(screen.getByRole('switch'), 'valueChange', true));
    await act(async () => fireEvent.press(screen.getByText('Selbstversuch anlegen')));
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

  it('keeps a stored length that is no whole choice on offer after picking another', async () => {
    const db = diary('2026-09-01');
    const odd = add(db, 'Kein Kaffee', '2026-09-20', 30);
    mockParams = { id: String(odd.id) };
    await render(<ExperimentFormScreen />);
    await act(async () => fireEvent.press(screen.getByLabelText('Dauer: 30 Tage')));
    await act(async () => fireEvent.press(screen.getByText('6 Wochen')));
    await act(async () => fireEvent.press(screen.getByLabelText('Dauer: 6 Wochen')));
    await act(async () => fireEvent.press(screen.getByText('30 Tage')));
    await act(async () => fireEvent.press(screen.getByText('Speichern')));
    expect(getExperiment(db, odd.id)!.end_date).toBe('2026-10-19');
  });

  it('asks before new dates remove answers, and keeps them on cancel', async () => {
    const db = diary('2026-09-01');
    const running = createExperiment(db, { title: 'Kein Kaffee', start_date: '2026-09-10', days: 28, check_in: true }, today);
    setExperimentDays(db, '2026-09-12', { [running.id]: true }, today);
    setExperimentDays(db, today, { [running.id]: true }, today);
    useDataVersion.getState().bump();
    mockParams = { id: String(running.id) };
    await render(<ExperimentFormScreen />);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await pickStart(/^Beginn/, new Date(2026, 8, 15, 12));
    await act(async () => fireEvent.press(screen.getByText('Speichern')));
    expect(alert).toHaveBeenCalledTimes(1);
    expect(alert.mock.calls[0]![0]).toBe('Antworten entfernen?');
    expect(alert.mock.calls[0]![1]).toMatch(/^„Kein Kaffee“ läuft dann vom .*15\. September.* bis .*Antworten außerhalb dieser Tage werden beim Speichern entfernt\.$/);
    // Nothing is written until "Speichern" in the question; "Abbrechen" just closes it.
    expect(getExperiment(db, running.id)!.start_date).toBe('2026-09-10');
    expect(listExperimentDays(db, running.id)).toHaveLength(2);
    await act(async () => fireEvent.press(screen.getByText('Speichern')));
    await pressAlertButton(alert, 'Speichern');
    expect(getExperiment(db, running.id)!.start_date).toBe('2026-09-15');
    expect(listExperimentDays(db, running.id).map((day) => day.date)).toEqual([today]);
    alert.mockRestore();
  });

  it('saves new dates without asking when no answer falls outside them', async () => {
    const db = diary('2026-09-01');
    const running = createExperiment(db, { title: 'Kein Kaffee', start_date: '2026-09-10', days: 28, check_in: true }, today);
    setExperimentDays(db, today, { [running.id]: true }, today);
    useDataVersion.getState().bump();
    mockParams = { id: String(running.id) };
    await render(<ExperimentFormScreen />);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await pickStart(/^Beginn/, new Date(2026, 8, 15, 12));
    await act(async () => fireEvent.press(screen.getByText('Speichern')));
    expect(alert).not.toHaveBeenCalled();
    expect(getExperiment(db, running.id)!.start_date).toBe('2026-09-15');
    alert.mockRestore();
  });

  it('keeps start and length of one that is over', async () => {
    const db = diary('2026-09-01');
    const over = add(db, 'Früh schlafen', '2026-08-01', 14);
    mockParams = { id: String(over.id) };
    await render(<ExperimentFormScreen />);
    expect(screen.queryByLabelText(/^Dauer/)).toBeNull();
    expect(screen.getByText(/Nach dem Ende bleiben Beginn und Dauer/)).toBeTruthy();
    // It asks no more once over (E17), so there is no switch for the question either.
    expect(screen.queryByText(/Täglich fragen/)).toBeNull();
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
    expect(screen.getByText(/^Noch zu wenige Tage zum Vergleichen\. Tage mit Eintrag: davor 5, im Selbstversuch 7\./)).toBeTruthy();
    expect(screen.queryByText(BROKEN)).toBeNull();
  });

  it('says it without "noch" once it is over', async () => {
    const db = diary('2026-07-28');
    const over = add(db, 'Kein Kaffee', '2026-08-01', 14);
    mockParams = { id: String(over.id) };
    await render(<ExperimentDetailScreen />);
    expect(screen.getByText(/^Zu wenige Tage zum Vergleichen\. Tage mit Eintrag: davor 4, im Selbstversuch 14\./)).toBeTruthy();
    expect(screen.queryByText(/Noch zu wenige/)).toBeNull();
  });

  it('says that one ended after a few days never gets a comparison', async () => {
    const db = diary('2026-06-01');
    const short = add(db, 'Kein Kaffee', '2026-09-20');
    endExperiment(db, short.id, '2026-09-23' as DateString);
    useDataVersion.getState().bump();
    mockParams = { id: String(short.id) };
    await render(<ExperimentDetailScreen />);
    expect(screen.getByText('Der Selbstversuch lief nur 3 Tage. Für einen Vergleich braucht es mindestens 7 Tage.')).toBeTruthy();
  });

  it('offers no "Jetzt beenden" on the start day, and one a "no" ended there is over', async () => {
    const db = diary('2026-06-01');
    const fresh = add(db, 'Kein Kaffee', today);
    mockParams = { id: String(fresh.id) };
    await render(<ExperimentDetailScreen />);
    expect(screen.queryByText('Jetzt beenden')).toBeNull();
    expect(screen.getByText('Selbstversuch löschen')).toBeTruthy();

    setExperimentDays(db, today, { [fresh.id]: false }, today);
    await act(async () => useDataVersion.getState().bump());
    expect(screen.getByText('Der Selbstversuch lief nur 1 Tag. Für einen Vergleich braucht es mindestens 7 Tage.')).toBeTruthy();
    expect(screen.queryByText('Jetzt beenden')).toBeNull();
    await render(<ExperimentsScreen />);
    expect(screen.getByText('VORBEI')).toBeTruthy();
    expect(screen.queryByText('LÄUFT')).toBeNull();
  });

  it('shows the interim numbers without a verdict while it runs, and ends it on request', async () => {
    const db = diary('2026-01-01');
    const running = add(db, 'Kein Kaffee', '2026-09-10');
    mockParams = { id: String(running.id) };
    await render(<ExperimentDetailScreen />);
    expect(screen.getByText(/^Zwischenstand nach 17 von 28 Tagen: Im Selbstversuch lag deine Stimmung/)).toBeTruthy();
    expect(screen.getByText(/zeigt Daylight am Ende/)).toBeTruthy();
    expect(screen.queryByText(/der Fälle/)).toBeNull();
    expect(screen.getByText(/es zeigt keine Ursache/)).toBeTruthy();
    expect(screen.queryByText(BROKEN)).toBeNull();

    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await act(async () => fireEvent.press(screen.getByText('Jetzt beenden')));
    expect(alert.mock.calls.at(-1)![1]).toMatch(/Der Vergleich nimmt nur die Tage bis dahin\.$/);
    await pressAlertButton(alert, 'Beenden');
    expect(getExperiment(db, running.id)!.end_date).toBe('2026-09-25');
    alert.mockRestore();
  });

  it('says before "Jetzt beenden" that it removes today\'s answer', async () => {
    const db = diary('2026-01-01');
    const running = createExperiment(db, { title: 'Kein Kaffee', start_date: '2026-09-10', days: 28, check_in: true }, today);
    setExperimentDays(db, today, { [running.id]: true }, today);
    useDataVersion.getState().bump();
    mockParams = { id: String(running.id) };
    await render(<ExperimentDetailScreen />);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await act(async () => fireEvent.press(screen.getByText('Jetzt beenden')));
    expect(alert.mock.calls.at(-1)![1]).toMatch(/Antworten nach diesem Tag werden entfernt\.$/);
    alert.mockRestore();
  });

  it('judges the difference once it is over and marks the result seen', async () => {
    const db = diary('2025-09-27', { from: '2026-08-01', to: '2026-08-28' });
    // Created while it still ran, so the result is not seen yet.
    const over = add(db, 'Kein Kaffee', '2026-08-01', 28, '2026-08-10' as DateString);
    expect(over.result_seen).toBe(false);
    mockParams = { id: String(over.id) };
    await render(<ExperimentDetailScreen />);
    expect(screen.getByText(/^Im Selbstversuch lag deine Stimmung im Schnitt bei 5,0, in den 28 Tagen davor bei/)).toBeTruthy();
    expect(screen.getByText(/^In deiner Vorgeschichte gab es einen so großen Unterschied zwischen zwei aufeinanderfolgenden Zeiträumen wie diesen nur in .* der Fälle\.$/)).toBeTruthy();
    expect(screen.queryByText(/Vorläufig/)).toBeNull();
    expect(screen.queryByText(/Zwischenstand/)).toBeNull();
    expect(screen.getByText(/es zeigt keine Ursache/)).toBeTruthy();
    expect(screen.queryByText('Jetzt beenden')).toBeNull();
    expect(screen.queryByText(BROKEN)).toBeNull();
    expect(getExperiment(db, over.id)!.result_seen).toBe(true);
  });

  it('names overlaps, seasons, the return to the usual and the many values', async () => {
    // A year of 3 and 4, then eight weeks of 2 right before the start, 5 in the experiment; an
    // energy scale that rises with it. Spring before, summer in it.
    const db = createTestDb();
    const moods = listMoods(db);
    const energy = createScale(db, { name: 'Energie' });
    for (let i = 0; ; i++) {
      const date = addDaysToDateString('2025-06-01' as DateString, i);
      if (date > today) break;
      const level = date >= '2026-06-15' && date <= '2026-08-09' ? 5 : date >= '2026-04-20' && date < '2026-06-15' ? 2 : 3 + (i % 2);
      createEntry(db, { date, time: '20:00', mood_id: moods[5 - level]!.id, scales: [{ scale_id: energy.id, value: level >= 5 ? 5 : 1 + (i % 3) }] });
    }
    mockDb = db;
    const over = createExperiment(db, { title: 'Kein Kaffee', start_date: '2026-06-15', days: 56 }, today);
    createExperiment(db, { title: 'Abendspaziergang', start_date: '2026-07-01', days: 14 }, today);
    createExperiment(db, { title: 'Früher schlafen', start_date: '2026-05-01', days: 7 }, today);
    useDataVersion.getState().bump();
    useSettingsStore.getState().load();
    mockParams = { id: String(over.id) };
    await render(<ExperimentDetailScreen />);
    expect(screen.getByText('Lief gleichzeitig mit: Abendspaziergang.')).toBeTruthy();
    expect(screen.getByText('Im Zeitraum davor lief: Früher schlafen.')).toBeTruthy();
    expect(screen.getByText(/verschiedenen Jahreszeiten/)).toBeTruthy();
    expect(screen.getByText(/Rückkehr zum Gewohnten/)).toBeTruthy();
    expect(screen.getByText('Je mehr Werte verglichen werden, desto eher fällt einer zufällig auf.')).toBeTruthy();
    // The chart has no mean here, so its label does not say "Schnitt ,".
    expect(screen.getByLabelText(/^Stimmung vom .+, \d+ Tage, zuletzt im 7-Tage-Mittel \d,\d$/)).toBeTruthy();
    // The verdict of a scale stands in its own line under the values, so the name keeps its room.
    expect(screen.getByText(/^(größer als üblich|im Rahmen), /)).toBeTruthy();
    expect(screen.getByLabelText(/^Energie: .+ → .+, (größer als üblich|im Rahmen), /)).toBeTruthy();
    expect(screen.queryByText(BROKEN)).toBeNull();
  });

  it('says when the history before it is too short to judge', async () => {
    const db = diary('2026-06-20', { from: '2026-08-01', to: '2026-08-28' });
    const over = add(db, 'Kein Kaffee', '2026-08-01');
    mockParams = { id: String(over.id) };
    await render(<ExperimentDetailScreen />);
    expect(screen.getByText('Für einen Vergleich mit deinen üblichen Schwankungen reicht die Zeit vor dem Selbstversuch nicht.')).toBeTruthy();
    expect(screen.queryByText(BROKEN)).toBeNull();
  });

  it('deletes one after asking', async () => {
    const db = diary('2026-09-01');
    const planned = add(db, 'Abendspaziergang', '2026-10-05');
    mockParams = { id: String(planned.id) };
    await render(<ExperimentDetailScreen />);
    expect(screen.getByText(/^Er beginnt am/)).toBeTruthy();
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await act(async () => fireEvent.press(screen.getByText('Selbstversuch löschen')));
    await pressAlertButton(alert, 'Selbstversuch löschen');
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
    expect(screen.queryByText('2 Selbstversuche gehen verloren.')).toBeNull();
    await act(async () => fireEvent.press(screen.getByText('Ersetzen')));
    expect(screen.getByText('2 Selbstversuche gehen verloren.')).toBeTruthy();
    await act(async () => usePendingImport.getState().set(null));
  });
});
