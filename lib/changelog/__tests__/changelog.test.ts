import { LANGUAGES } from '@/lib/i18n/language';

import { RELEASES } from '..';

/** The first version written in every language of the app; older ones have German and English only. */
const ALL_LANGUAGES_SINCE = [1, 0, 29];

const atLeast = (version: string, minimum: number[]) => {
  const parts = version.split('.').map(Number);
  const index = parts.findIndex((part, i) => part !== minimum[i]);
  return index === -1 || (parts[index] ?? 0) > (minimum[index] ?? 0);
};

describe('changelog', () => {
  it('has every entry in German and English, point for point', () => {
    for (const release of RELEASES) {
      expect(release.changes.de.length).toBeGreaterThan(0);
      expect([release.version, release.changes.en.length]).toEqual([release.version, release.changes.de.length]);
    }
  });

  it('has every other language it names point for point, and all of them from 1.0.29 on', () => {
    for (const release of RELEASES) {
      for (const language of LANGUAGES) {
        const points = release.changes[language];
        if (points === undefined && !atLeast(release.version, ALL_LANGUAGES_SINCE)) continue;
        expect([release.version, language, points?.length]).toEqual([release.version, language, release.changes.de.length]);
      }
    }
  });
});
