import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import '@/lib/i18n';
import type { Database } from '@/db';
import { createEntry } from '@/db/repositories/entries';
import { createTestDb } from '@/db/testDb';
import { today, addDaysToDateString } from '@/lib/dates';
import { useDataVersion } from '@/lib/store/dataVersion';
import { useSettingsStore } from '@/lib/store/settingsStore';

import { BackupCard } from '../BackupCard';

/** The backup card on "Heute": when it comes, where it leads, and that it can be put away. */
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => ({ ...require('react-native-reanimated/mock'), useReducedMotion: () => false }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('@expo/vector-icons/MaterialCommunityIcons', () => () => null);
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
let mockDb: Database | null = null;
jest.mock('@/db/client', () => ({ getDb: () => mockDb, DATABASE_NAME: 'test.db' }));

function withEntrySince(days: number) {
  mockDb = createTestDb();
  createEntry(mockDb, { date: addDaysToDateString(today(), -days), time: '20:30', mood_id: 2 });
  useDataVersion.getState().bump();
  useSettingsStore.getState().load();
}

describe('BackupCard', () => {
  beforeEach(() => jest.mocked(router.push).mockClear());

  it('stays away while the diary is young', async () => {
    withEntrySince(5);
    await render(<BackupCard />);
    expect(screen.queryByText('Zeit für eine Sicherung')).toBeNull();
  });

  it('offers the automatic backup after a month without one, and goes away when put away', async () => {
    withEntrySince(40);
    await render(<BackupCard />);
    expect(screen.getByText('Zeit für eine Sicherung')).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Einrichten' })));
    expect(router.push).toHaveBeenCalledWith('/more/backup');
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Später' })));
    expect(useSettingsStore.getState().settings?.backup_hint_dismissed_on).toBe(today());
    expect(screen.queryByText('Zeit für eine Sicherung')).toBeNull();
  });

  it('is quiet while the automatic backup works', async () => {
    withEntrySince(40);
    useSettingsStore.getState().update({ auto_backup_dir: 'content://x/tree/primary%3ADaylight' });
    await render(<BackupCard />);
    expect(screen.queryByText('Zeit für eine Sicherung')).toBeNull();
  });

  it('tells when the automatic backup keeps failing', async () => {
    withEntrySince(40);
    useSettingsStore.getState().update({ auto_backup_dir: 'content://x/tree/primary%3ADaylight', auto_backup_error: 'folder-missing' });
    await render(<BackupCard />);
    expect(screen.getByText('Automatische Sicherung klappt nicht')).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Ansehen' })));
    expect(router.push).toHaveBeenCalledWith('/more/backup');
  });
});
