import { eq } from 'drizzle-orm';

import { activities, activityGroups, moods, scales } from '../schema';
import type { Database } from '../types';

type Sortable = typeof activities | typeof activityGroups | typeof moods | typeof scales;

/** Writes `sort_order` 0, 1, 2 ... in the given order, in one transaction. Ids not listed keep theirs. */
export function writeOrder(db: Database, table: Sortable, orderedIds: readonly number[]): void {
  db.transaction((tx) => {
    orderedIds.forEach((id, index) => {
      tx.update(table).set({ sort_order: index }).where(eq(table.id, id)).run();
    });
  });
}
