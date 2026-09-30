import { RELEASES } from '..';

describe('changelog', () => {
  it('has every entry in German and English, point for point', () => {
    for (const release of RELEASES) {
      expect(release.changes.de.length).toBeGreaterThan(0);
      expect([release.version, release.changes.en.length]).toEqual([release.version, release.changes.de.length]);
    }
  });
});
