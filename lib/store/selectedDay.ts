import { create } from 'zustand';

import type { DateString } from '@/lib/dates';

interface SelectedDayState {
  /** The day "Heute" shows; null means today, whichever day that currently is. */
  picked: DateString | null;
  pick: (date: DateString | null) => void;
}

/**
 * Shared between the calendar (which opens a day) and "Heute" (which shows it). Today is stored
 * as null rather than as a date, so the tab moves on by itself at midnight instead of staying
 * on yesterday (the lesson from Zyklus 1.0.10).
 */
export const useSelectedDayStore = create<SelectedDayState>((set) => ({
  picked: null,
  pick: (picked) => set({ picked }),
}));

/** The day "Heute" shows, given today's date. Picking today stores null. */
export function useSelectedDay(today: DateString): [DateString, (date: DateString) => void] {
  const picked = useSelectedDayStore((s) => s.picked);
  const pick = useSelectedDayStore((s) => s.pick);
  return [picked ?? today, (date) => pick(date === today ? null : date)];
}
