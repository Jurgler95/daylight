import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';

import '@/lib/i18n';
import { EntryEditor } from '@/components/entry/EntryEditor';
import type { Database } from '@/db';
import { createActivity, getActivity, listActivities, listEntryDetails, listGroups, listMoods } from '@/db/repositories';
import { createTestDb } from '@/db/testDb';
import type { DateString } from '@/lib/dates';
import { useDataVersion } from '@/lib/store/dataVersion';
import { useSettingsStore } from '@/lib/store/settingsStore';

/** Adding and archiving activities from the chips in the entry editor. */
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

let db: Database;
let mood: number;

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

async function openEditor() {
  const group = listGroups(db)[0]!;
  await render(<EntryEditor target={{ kind: 'new', date: '2026-09-26' as DateString, moodId: mood }} />);
  const label = `Neue Aktivität in ${group.name}`;
  await act(async () => fireEvent.press(screen.getByRole('button', { name: label })));
  return { group, field: () => screen.getByLabelText(label) };
}

describe('activity chips in the entry editor', () => {
  it('takes a name still in the field when "Speichern" is tapped, and saves it on the entry', async () => {
    const { group, field } = await openEditor();
    await act(async () => fireEvent.changeText(field(), 'Kino'));
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Speichern' })));
    const kino = listActivities(db).find((activity) => activity.name === 'Kino');
    expect(kino?.group_id).toBe(group.id);
    const saved = listEntryDetails(db);
    expect(saved).toHaveLength(1);
    expect(saved[0]!.activity_ids).toContain(kino!.id);
  });

  it('takes the name when the field loses focus', async () => {
    const { field } = await openEditor();
    await act(async () => fireEvent.changeText(field(), 'Kino'));
    await act(async () => fireEvent(field(), 'blur'));
    expect(listActivities(db).filter((activity) => activity.name === 'Kino')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Kino' })).toBeTruthy();
  });

  it('archives a held chip after asking', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    const activity = createActivity(db, { group_id: listGroups(db)[0]!.id, name: 'Lesen' });
    useDataVersion.getState().bump();
    await openEditor();
    await act(async () => fireEvent(screen.getByRole('button', { name: activity.name }), 'longPress'));
    expect(alert.mock.calls.at(-1)![0]).toBe(`„${activity.name}“ archivieren?`);
    const buttons = alert.mock.calls.at(-1)![2] as { text: string; onPress?: () => void }[];
    await act(async () => buttons.find((button) => button.text === 'Archivieren')!.onPress?.());
    expect(getActivity(db, activity.id)?.archived).toBe(true);
    expect(screen.queryByRole('button', { name: activity.name })).toBeNull();
  });
});
