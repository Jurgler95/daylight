import { SYSTEM_SCREEN_GRACE_SECONDS, handleAppStateChange, shouldRelock, useLockStore, withLockSuspended } from '../store';

describe('shouldRelock', () => {
  it('locks once the app was away at least the delay', () => {
    expect(shouldRelock(1_000, 1_000, 0)).toBe(true);
    expect(shouldRelock(1_000, 61_000, 60)).toBe(true);
    expect(shouldRelock(1_000, 60_999, 60)).toBe(false);
  });

  it('does not lock again when no departure was recorded, as right after unlocking with the device PIN', () => {
    expect(shouldRelock(null, 5_000, 0)).toBe(false);
  });
});

describe('handleAppStateChange', () => {
  beforeEach(() => useLockStore.setState({ locked: false, leftAt: null, leftForSystem: false, suspended: 0 }));

  it('locks already on leaving when the delay is zero', () => {
    handleAppStateChange('background', 1_000, 0);
    expect(useLockStore.getState().locked).toBe(true);
  });

  it('waits for the way back when there is a delay', () => {
    handleAppStateChange('background', 1_000, 60);
    expect(useLockStore.getState().locked).toBe(false);
    handleAppStateChange('active', 30_000, 60);
    expect(useLockStore.getState().locked).toBe(false);
    handleAppStateChange('background', 40_000, 60);
    handleAppStateChange('active', 100_000, 60);
    expect(useLockStore.getState().locked).toBe(true);
  });

  it('does not lock on the way back from a system screen the app opened itself', async () => {
    let close = () => undefined as void;
    const picking = withLockSuspended(() => new Promise<void>((resolve) => (close = resolve)));
    handleAppStateChange('background', 1_000, 0);
    expect(useLockStore.getState().locked).toBe(false);
    close();
    await picking;
    handleAppStateChange('active', 20_000, 0);
    expect(useLockStore.getState()).toMatchObject({ locked: false, leftAt: null, suspended: 0 });
  });

  it('still locks when the system screen stayed in front past the grace time', async () => {
    await withLockSuspended(async () => handleAppStateChange('background', 1_000, 0));
    handleAppStateChange('active', 1_000 + SYSTEM_SCREEN_GRACE_SECONDS * 1000, 0);
    expect(useLockStore.getState().locked).toBe(true);
  });

  it('ends the suspension even when the system screen fails', async () => {
    await expect(withLockSuspended(() => Promise.reject(new Error('no picker')))).rejects.toThrow('no picker');
    expect(useLockStore.getState().suspended).toBe(0);
  });
});
