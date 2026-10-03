import { countsAsOpen, OPEN_AWAY_MS } from '../opens';

describe('countsAsOpen', () => {
  it('counts a return after a minute away, not a quick trip to the fingerprint prompt', () => {
    expect(countsAsOpen(5_000)).toBe(false);
    expect(countsAsOpen(OPEN_AWAY_MS)).toBe(true);
    expect(countsAsOpen(3_600_000)).toBe(true);
  });
});
