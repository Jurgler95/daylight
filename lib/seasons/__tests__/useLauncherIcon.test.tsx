import { act, render } from '@testing-library/react-native';

import { createTestDb } from '@/db/testDb';
import type { Database } from '@/db/types';
import { useLockStore, withLockSuspended } from '@/lib/lock/store';
import { useSettingsStore } from '@/lib/store/settingsStore';
import Launcher from '@/modules/daylight-launcher';

import { DesignProvider } from '../useDesign';
import { useLauncherIcon } from '../useLauncherIcon';

jest.mock('@/modules/daylight-launcher', () => ({ __esModule: true, default: { current: jest.fn(() => 'logo'), setTarget: jest.fn(), setHeld: jest.fn() } }));
let mockDb: Database | null = null;
jest.mock('@/db/client', () => ({ getDb: () => mockDb, DATABASE_NAME: 'test.db' }));
jest.mock('@/lib/dates/useToday', () => ({ useToday: () => '2026-10-31' }));

const mockLauncher = Launcher as unknown as { setTarget: jest.Mock; setHeld: jest.Mock };

function Probe() {
  useLauncherIcon();
  return null;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockDb = createTestDb();
  useSettingsStore.getState().load();
  useLockStore.setState({ suspended: 0, authenticating: false });
});

const mount = () =>
  render(
    <DesignProvider>
      <Probe />
    </DesignProvider>,
  );

describe('useLauncherIcon', () => {
  it('asks for the design of the day, and for the logo once the designs are off', async () => {
    await mount();
    expect(mockLauncher.setTarget).toHaveBeenLastCalledWith('halloween');
    await act(async () => useSettingsStore.getState().update({ design_seasons: false }));
    expect(mockLauncher.setTarget).toHaveBeenLastCalledWith('logo');
  });

  it('holds the switch while a system screen the app opened is in front', async () => {
    await mount();
    expect(mockLauncher.setHeld).toHaveBeenLastCalledWith(false);
    let close = () => {};
    const picking = withLockSuspended(() => new Promise<void>((resolve) => (close = resolve)));
    // Synchronously, before the picker could take the screen.
    expect(mockLauncher.setHeld).toHaveBeenLastCalledWith(true);
    close();
    await act(async () => picking);
    expect(mockLauncher.setHeld).toHaveBeenLastCalledWith(false);
    await act(async () => useLockStore.setState({ authenticating: true }));
    expect(mockLauncher.setHeld).toHaveBeenLastCalledWith(true);
  });
});
