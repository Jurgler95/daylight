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
    size: (name) => mockFiles.get(name)?.length ?? null,
    write: (name, _mime, fill) => {
      const chunks: Uint8Array[] = [];
      fill((chunk) => chunks.push(chunk));
      mockFiles.set(name, Uint8Array.from(chunks.flatMap((chunk) => [...chunk])));
    },
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
    expect(screen.getByText(/Die letzten 7 bleiben/)).toBeTruthy();
    expect(screen.queryByText(/\{\{/)).toBeNull();
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Ordner wählen' })));
    expect(useSettingsStore.getState().settings?.auto_backup_dir).toBe(DIR);
    expect(screen.getByText('Documents/Daylight')).toBeTruthy();
    expect([...mockFiles.keys()]).toEqual([expect.stringMatching(/^daylight-auto-\d{4}-\d{2}-\d{2}-\d{4}\.json$/)]);
    expect(screen.getByText(/^Zuletzt gesichert am/)).toBeTruthy();
    expect(Alert.alert).toHaveBeenCalledWith('Gesichert');
  });

  it('points to the import when the folder already holds backups, perhaps from the old phone', async () => {
    (Alert.alert as jest.Mock).mockClear();
    const old = new Uint8Array(5000);
    mockFiles.set('daylight-auto-2026-08-01-2100.json', old);
    await render(<AutoBackupScreen />);
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Ordner wählen' })));
    expect(useSettingsStore.getState().settings?.auto_backup_dir).toBeNull();
    const [title, body, buttons] = (Alert.alert as jest.Mock).mock.calls[0]!;
    expect(title).toBe('Hier liegen schon Sicherungen');
    expect(body).toContain('„Importieren“');
    // "Ordner trotzdem verwenden" goes ahead; the old backup stays next to the new one.
    await act(async () => buttons.find((button: { text: string }) => button.text === 'Ordner trotzdem verwenden').onPress());
    expect(useSettingsStore.getState().settings?.auto_backup_dir).toBe(DIR);
    expect(mockFiles.get('daylight-auto-2026-08-01-2100.json')).toBe(old);
    expect(mockFiles.size).toBe(2);
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
