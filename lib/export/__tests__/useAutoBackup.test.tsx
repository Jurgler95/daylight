import { act, renderHook } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';

import type { Database } from '@/db';
import { createTestDb } from '@/db/testDb';
import { useDataVersion } from '@/lib/store/dataVersion';
import { useSettingsStore } from '@/lib/store/settingsStore';

import { AUTO_BACKUP_CHANGE_DELAY_MS, AUTO_BACKUP_REPLACE_DELAY_MS, runAutoBackup } from '../auto';
import { autoBackupNow, START_DELAY_MS, useAutoBackup } from '../useAutoBackup';

/** When the automatic backup runs: after the start, after changes, and at once when the app leaves. */
let mockDb: Database | null = null;
jest.mock('@/db/client', () => ({ getDb: () => mockDb, DATABASE_NAME: 'test.db' }));
jest.mock('@/lib/photos/fileStore', () => ({ filePhotoStore: {} }));
jest.mock('../autoFolder', () => ({ storageFolder: () => ({}) }));
jest.mock('../auto', () => ({ ...jest.requireActual('../auto'), runAutoBackup: jest.fn(() => 'unchanged') }));

const DIR = 'content://com.android.externalstorage.documents/tree/primary%3ADocuments%2FDaylight';
const run = runAutoBackup as jest.Mock;
let appStateListener: ((state: AppStateStatus) => void) | null = null;

const change = () => act(async () => useDataVersion.getState().bump());
const wait = (ms: number) => act(async () => jest.advanceTimersByTime(ms));
const now = (fn: () => void) => act(async () => fn());

async function mount() {
  return renderHook(() => useAutoBackup());
}

describe('useAutoBackup', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 8, 15, 20, 0));
    mockDb = createTestDb();
    useSettingsStore.getState().load();
    useSettingsStore.getState().update({ auto_backup_dir: DIR });
    run.mockClear();
    run.mockReturnValue('unchanged');
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
      appStateListener = listener as (state: AppStateStatus) => void;
      return { remove: () => (appStateListener = null) };
    });
    useDataVersion.getState().bump();
  });

  afterEach(() => {
    jest.useRealTimers();
    (AppState.addEventListener as jest.Mock).mockRestore();
  });

  it('does nothing without a folder', async () => {
    useSettingsStore.getState().update({ auto_backup_dir: null });
    await mount();
    await wait(START_DELAY_MS);
    await change();
    await wait(AUTO_BACKUP_REPLACE_DELAY_MS);
    expect(run).not.toHaveBeenCalled();
  });

  it('runs 5 seconds after the start', async () => {
    await mount();
    await wait(START_DELAY_MS - 1);
    expect(run).not.toHaveBeenCalled();
    await wait(1);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('runs 3 seconds after the last of several changes, when the day has no backup yet', async () => {
    await mount();
    await change();
    await wait(2000);
    await change();
    await wait(AUTO_BACKUP_CHANGE_DELAY_MS - 1);
    expect(run).not.toHaveBeenCalled();
    await wait(1);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('waits a minute before replacing the day\'s file, and runs at once when the app goes to the background', async () => {
    useSettingsStore.getState().update({ auto_backup_at: new Date(2026, 8, 15, 8, 0).toISOString() });
    await mount();
    await change();
    await wait(AUTO_BACKUP_CHANGE_DELAY_MS);
    expect(run).not.toHaveBeenCalled();
    await now(() => appStateListener?.('background'));
    expect(run).toHaveBeenCalledTimes(1);
    // Nothing waits any more: neither the timer nor another trip to the background runs again.
    await wait(AUTO_BACKUP_REPLACE_DELAY_MS);
    await now(() => appStateListener?.('background'));
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('drops a waiting run when the backup is turned off', async () => {
    await mount();
    await change();
    await now(() => useSettingsStore.getState().update({ auto_backup_dir: null }));
    await wait(AUTO_BACKUP_REPLACE_DELAY_MS);
    expect(run).not.toHaveBeenCalled();
    expect(appStateListener).toBeNull();
  });

  it('starts over with the new folder when it changes', async () => {
    await mount();
    await wait(START_DELAY_MS - 1000);
    await now(() => useSettingsStore.getState().update({ auto_backup_dir: `${DIR}%2FNeu` }));
    await wait(1000);
    expect(run).not.toHaveBeenCalled();
    await wait(START_DELAY_MS - 1000);
    expect(run).toHaveBeenCalledTimes(1);
  });
});

describe('autoBackupNow', () => {
  beforeEach(() => {
    mockDb = createTestDb();
    useSettingsStore.getState().load();
    useSettingsStore.getState().update({ auto_backup_dir: DIR });
    run.mockClear();
    useDataVersion.getState().bump();
  });

  it('does not build the export again for a data version it already found saved', () => {
    run.mockReturnValue('unchanged');
    expect(autoBackupNow()).toBe('unchanged');
    expect(autoBackupNow()).toBe('unchanged');
    expect(run).toHaveBeenCalledTimes(1);
    useDataVersion.getState().bump();
    autoBackupNow();
    expect(run).toHaveBeenCalledTimes(2);
    // "Jetzt sichern" always runs.
    run.mockReturnValue('written');
    expect(autoBackupNow(true)).toBe('written');
    expect(run).toHaveBeenCalledTimes(3);
  });

  it('tries again after a failure, on the same data version', () => {
    run.mockReturnValue('failed');
    autoBackupNow();
    autoBackupNow();
    expect(run).toHaveBeenCalledTimes(2);
  });
});
