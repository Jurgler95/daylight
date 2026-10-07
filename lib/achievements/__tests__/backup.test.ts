import { listActivities } from '@/db/repositories';
import { listEntryDetails } from '@/db/repositories/entries';
import { createTestDb } from '@/db/testDb';
import type { Database } from '@/db/types';
import type { DateString } from '@/lib/dates';
import { isStarterActivity } from '@/lib/daylio/known';
import { generateSample } from '@/lib/dev/generateSample';
import { applySample } from '@/lib/dev/sample';
import { applyImport, buildExport, parseImport } from '@/lib/export';

import { buildAchievements } from '../achievements';
import { parseSeen, quietSeen, starNews } from '../news';

const today = '2026-09-26' as DateString;

function achievementsOf(db: Database) {
  return buildAchievements({
    entries: listEntryDetails(db),
    health: [],
    activities: listActivities(db, { includeArchived: true }),
    isStarter: isStarterActivity,
    opens: 0,
    turningPoints: 0,
    today,
    firstDayOfWeek: 1,
  });
}

describe('achievements after a restored backup', () => {
  it('come back in full on a fresh install, and the stars are announced', () => {
    const old = createTestDb();
    applySample(old, generateSample({ today }));
    const before = achievementsOf(old);

    // A fresh install: empty diary, first check stores "no stars" without a message.
    const fresh = createTestDb();
    const seen = quietSeen(achievementsOf(fresh), null);
    expect(seen).not.toBeNull();

    applyImport(fresh, parseImport(JSON.stringify(buildExport(old, '1.0.0'))), 'replace');
    const after = achievementsOf(fresh);
    expect(after.map((a) => [a.key, a.best, a.stars])).toEqual(before.map((a) => [a.key, a.best, a.stars]));
    expect(starNews(after, parseSeen(JSON.stringify(seen)))).toMatchObject({ kind: 'stars' });
  });
});
