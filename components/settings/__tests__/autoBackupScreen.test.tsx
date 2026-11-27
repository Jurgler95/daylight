import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';

import '@/lib/i18n';
import type { Database } from '@/db';
import { createEntry } from '@/db/repositories/entries';
import { createTestDb } from '@/db/testDb';
import type { BackupFolder } from '@/lib/export/auto';
import { useDataVersion } from '@/lib/store/dataVersion';
import { useSettingsStore } from '@/lib/store/settingsStore';

import AutoBackupScreen from '../../../app/more/backup';

/** "Automatische Sicherung": picking the folder writes the first backup, failures show on the screen. */
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => ({ ...require('react-native-reanimated/mock'), useReducedMotion: () => false }));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('@expo/vector-icons/MaterialCommunityIcons', () => () => null);
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), navigate: jest.fn(), back: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => ({}),
  usePathname: () => '/more/backup',
}));
let mockDb: Database | null = null;
jest.mock('@/db/client', () => ({ getDb: () => mockDb, DATABASE_NAME: 'test.db' }));

const mockFiles = new Map<string, Uint8Array>();
let mockGone = false;
const DIR = 'content://com.android.externalstorage.documents/tree/primary%3ADocuments%2FDaylight';
jest.mock('@/lib/export/autoFolder', () => ({
  pickBackupFolder: () => Promise.resolve(DIR),
  storageFolder: (): BackupFolder => ({
    exists: () => !mockGone,
    list: () => [...mockFiles.keys()],
    write: (name, _mime, bytes) => void mockFiles.set(name, bytes),
    remove: (name) => void mockFiles.delete(name),
  }),
}));

describe('automatic backup settings', () => {
  beforeEach(() => {
    mockDb = createTestDb();
    createEntry(mockDb, { date: '2026-09-01', time: '20:30', mood_id: 2 });
    mockFiles.clear();
    mockGone = false;
    useDataVersion.getState().bump();
    useSettingsStore.getState().load();
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  it('picks a folder and writes the first backup there right away', async () => {
    await render(<AutoBackupScreen />);
    expect(screen.getByText('Noch kein Ordner gewählt')).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Ordner wählen' })));
    expect(useSettingsStore.getState().settings?.auto_backup_dir).toBe(DIR);
    expect(screen.getByText('Documents/Daylight')).toBeTruthy();
    expect([...mockFiles.keys()]).toEqual([expect.stringMatching(/^daylight-auto-\d{4}-\d{2}-\d{2}-\d{4}\.json$/)]);
    expect(screen.getByText(/^Zuletzt gesichert am/)).toBeTruthy();
    expect(Alert.alert).toHaveBeenCalledWith('Gesichert');
  });

  it('shows a folder that went away, and the app carries on', async () => {
    useSettingsStore.getState().update({ auto_backup_dir: DIR });
    mockGone = true;
    await render(<AutoBackupScreen />);
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Jetzt sichern' })));
    expect(Alert.alert).toHaveBeenCalledWith('Sicherung fehlgeschlagen', expect.stringContaining('nicht mehr erreichbar'));
    expect(screen.getByText(/nicht mehr erreichbar/)).toBeTruthy();
    expect(screen.getByText('Noch keine automatische Sicherung')).toBeTruthy();
  });
});
