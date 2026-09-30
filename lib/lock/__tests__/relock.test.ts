import { shouldRelock } from '../store';

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
