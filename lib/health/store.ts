import { create } from 'zustand';

import type { DateString } from '@/lib/dates';

interface HealthSyncState {
  /** True while a sync runs; the indicator in the top right corner follows it. */
  running: boolean;
  /** First day of the month being read, only during a longer backfill. */
  month: DateString | null;
}

export const useHealthSyncStore = create<HealthSyncState>(() => ({ running: false, month: null }));
