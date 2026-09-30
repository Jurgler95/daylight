import { useMemo } from 'react';

import { getDb } from '@/db';
import { listEntryDetails } from '@/db/repositories/entries';
import { useCatalog } from '@/lib/catalog/useCatalog';
import type { DateString } from '@/lib/dates';
import { cached, useQuery } from '@/lib/store/dataVersion';

import { indexEntries, searchEntries, toSearchable, topActivities, type SearchQuery } from './search';
import { groupByMonth } from './timeline';

/** How many activities the filter offers as chips; the text field finds the rest. */
export const CHIP_COUNT = 16;

/**
 * The timeline of "Verlauf": every entry, or the ones matching the query, newest first and split
 * by month. The folded index is built once per data version; typing only filters it.
 */
export function useEntrySearch(query: SearchQuery, today: DateString) {
  const catalog = useCatalog();
  const index = useQuery(
    () =>
      cached('searchIndex', () =>
        indexEntries(listEntryDetails(getDb()).map(toSearchable), {
          activity: (id) => catalog.activityById.get(id)?.name,
          mood: (id) => catalog.moodById.get(id)?.label,
        }),
      ),
    [catalog],
  );
  const hits = useMemo(() => searchEntries(index, query, today), [index, query, today]);
  const sections = useMemo(() => groupByMonth(hits, (hit) => hit.entry.date), [hits]);
  const chipIds = useMemo(
    () =>
      topActivities(
        index.map((item) => item.entry),
        catalog.activities.map((activity) => activity.id),
        CHIP_COUNT,
      ),
    [index, catalog],
  );
  return { hits, sections, chipIds, total: index.length };
}
