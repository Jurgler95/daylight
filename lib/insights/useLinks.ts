import { useEffect, useMemo } from 'react';
import { create } from 'zustand';

import { getDb } from '@/db';
import { listHealthDays } from '@/db/repositories/health';
import { activityDescribesMood, type Catalog } from '@/lib/catalog/catalog';
import type { DateString } from '@/lib/dates';
import { cached, useQuery } from '@/lib/store/dataVersion';

import { linksSignature, linksSteps, type Links, type LinksInput } from './links';
import { readInsightDays } from './useInsights';

interface Finished {
  signature: string;
  links: Links;
}

interface LinksState {
  /** The last finished result. It stands in while a newer one is computed. */
  finished: Finished | null;
}

/**
 * The links test every factor against every other, which takes a moment on a long diary with many
 * activities. So like the hint for tomorrow they run outside rendering in slices of a few
 * milliseconds, once per distinct diary, shared by every screen. A newer diary replaces a run that
 * is still going.
 */
const useLinksStore = create<LinksState>(() => ({ finished: null }));
const SLICE_MS = 12;
let running: { signature: string; cancelled: boolean } | null = null;

function run(input: LinksInput, signature: string): void {
  // Cancel first: going back to a diary whose result is already there must still stop the run in between.
  if (running && running.signature !== signature) {
    running.cancelled = true;
    running = null;
  }
  if (running || useLinksStore.getState().finished?.signature === signature) return;
  const current = { signature, cancelled: false };
  running = current;
  const steps = linksSteps(input);
  const step = () => {
    if (current.cancelled) return;
    const started = Date.now();
    while (Date.now() - started < SLICE_MS) {
      const next = steps.next();
      if (next.done) {
        running = null;
        useLinksStore.setState({ finished: { signature, links: next.value } });
        return;
      }
    }
    setTimeout(step, 0);
  };
  setTimeout(step, 0);
}

/** Tests: a clean slate between diaries. */
export function resetLinks(): void {
  if (running) running.cancelled = true;
  running = null;
  useLinksStore.setState({ finished: null });
}

/** What the links are worked out from: every diary day, every activity and scale with its mark, sleep and steps. */
export function readLinksInput(catalog: Catalog, today: DateString): LinksInput {
  return {
    allDays: readInsightDays(),
    // Archived ones too: their days still belong to the diary.
    activities: catalog.activities.map((activity) => ({ id: activity.id, describesMood: activityDescribesMood(catalog, activity.id) })),
    scales: [...catalog.scaleById.values()].map(({ id, name, min, max, kind, describes_mood }) => ({ id, name, min, max, kind, describesMood: describes_mood })),
    health: cached('healthDays', () => listHealthDays(getDb())),
    today,
  };
}

/**
 * Factors that go together with better or worse days, over the last two years whatever range is
 * picked on "Einblicke". Null while the first result is computed; only computed while `active`,
 * so the other sections of the page cost nothing.
 */
export function useLinks(catalog: Catalog, today: DateString, active = true): Links | null {
  const input = useQuery(() => (active ? readLinksInput(catalog, today) : null), [active, catalog, today]);
  const signature = useMemo(() => (input ? linksSignature(input) : null), [input]);
  const finished = useLinksStore((state) => state.finished);
  useEffect(() => {
    if (input && signature) run(input, signature);
  }, [signature]); // eslint-disable-line react-hooks/exhaustive-deps
  return active && finished ? finished.links : null;
}
