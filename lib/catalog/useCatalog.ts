import { getDb } from '@/db';
import { listActivities, listGroups, listMoods, listScales } from '@/db/repositories';
import { cached, useQuery } from '@/lib/store/dataVersion';

import { buildCatalog, type Catalog } from './catalog';

export function readCatalogFromDb(): Catalog {
  const db = getDb();
  return buildCatalog({
    moods: listMoods(db, { includeArchived: true }),
    groups: listGroups(db),
    activities: listActivities(db, { includeArchived: true }),
    scales: listScales(db, { includeArchived: true }),
  });
}

/** Read once per data version, however many screens ask. */
export function useCatalog(): Catalog {
  return useQuery(() => cached('catalog', readCatalogFromDb), []);
}
