import { useCallback, useEffect, useMemo } from 'react';
import { create } from 'zustand';

import { getDb } from '@/db';
import { listHealthDays } from '@/db/repositories/health';
import { listTomorrowHints, markTomorrowHint } from '@/db/repositories/tomorrowHints';
import { addDaysToDateString, type DateString } from '@/lib/dates';
import type { InsightDay, ScaleFacts } from '@/lib/insights';
import { readInsightDays } from '@/lib/insights/useInsights';
import { cached, useDataVersion, useQuery } from '@/lib/store/dataVersion';
import { useSettingsStore } from '@/lib/store/settingsStore';

import { tomorrowSteps, WINDOW_DAYS, type BodyByDate, type TomorrowResult } from './tomorrow';

/** Everything the hint depends on: the day, every day's mood, activities and scale values, the scales, sleep and steps, and the hint days. */
export function tomorrowSignature(days: readonly InsightDay[], scales: readonly ScaleFacts[], body: BodyByDate, shown: readonly string[], today: DateString): string {
  const dayPart = days
    .map((day) => `${day.date}:${day.mean}:${[...day.activities].sort((a, b) => a - b).join(',')}:${[...day.scales].map(([id, v]) => `${id}=${v.sum}/${v.count}`).join(',')}`)
    .join('|');
  // Today's steps still grow with every sync and are not used until tomorrow, so they stay out.
  const bodyPart = [...body].map(([date, b]) => `${date}:${b.sleep}:${date >= today ? '' : b.steps}`).join('|');
  return `${today}#${shown.join(',')}#${scales.map((scale) => `${scale.id}:${scale.kind}:${scale.min}:${scale.max}`).join(',')}#${bodyPart}#${dayPart}`;
}

interface TomorrowState {
  signature: string | null;
  /** The last finished result; it stands in while a newer one is computed, unless the day changed. */
  today: DateString | null;
  result: TomorrowResult | null;
}

/**
 * The backtest refits the model about fifty times a year of diary, so like the outlook's it runs
 * outside rendering in slices of a few milliseconds, once per distinct diary, shared by every screen.
 */
const useTomorrowStore = create<TomorrowState>(() => ({ signature: null, today: null, result: null }));
const SLICE_MS = 12;
let job: { signature: string; cancelled: boolean } | null = null;

function run(input: Parameters<typeof tomorrowSteps>[0], signature: string): void {
  if (job?.signature === signature || useTomorrowStore.getState().signature === signature) return;
  if (job) job.cancelled = true;
  const current = { signature, cancelled: false };
  job = current;
  const steps = tomorrowSteps(input);
  const step = () => {
    if (current.cancelled) return;
    const started = Date.now();
    while (Date.now() - started < SLICE_MS) {
      const next = steps.next();
      if (next.done) {
        job = null;
        useTomorrowStore.setState({ signature, today: input.today, result: next.value });
        return;
      }
    }
    setTimeout(step, 0);
  };
  setTimeout(step, 0);
}

/** Tests: a clean slate between diaries. */
export function resetTomorrow(): void {
  if (job) job.cancelled = true;
  job = null;
  useTomorrowStore.setState({ signature: null, today: null, result: null });
}

/** Sleep and steps by day, from whatever Health Connect delivered; empty without it. */
function readBody(): BodyByDate {
  return cached('tomorrowBody', () => new Map(cached('healthDays', () => listHealthDays(getDb())).map((row) => [row.date, { sleep: row.sleep_minutes, steps: row.steps }])));
}

export interface TomorrowView {
  /** Null while computing for a new day. */
  result: TomorrowResult | null;
  /** Call when the hint was actually on screen, so it counts towards the next two weeks. */
  markShown: () => void;
}

/**
 * The hint for tomorrow and why it shows or not. Computed only behind the switch "Ausblick zeigen",
 * except where `always` asks for it (the outlook page explains the hint even while it is off).
 */
export function useGoodTomorrow(today: DateString, scales: readonly ScaleFacts[], always = false): TomorrowView {
  const enabled = useSettingsStore((s) => s.settings?.outlook_enabled ?? true);
  const active = enabled || always;
  const days = useQuery(() => readInsightDays(), []);
  const body = useQuery(() => readBody(), []);
  const shown = useQuery(() => listTomorrowHints(getDb(), addDaysToDateString(today, -WINDOW_DAYS)), [today]);
  const signature = useMemo(() => (active ? tomorrowSignature(days, scales, body, shown, today) : null), [active, days, scales, body, shown, today]);
  const state = useTomorrowStore();
  useEffect(() => {
    if (signature) run({ days, scales, today, shown, body }, signature);
  }, [signature]); // eslint-disable-line react-hooks/exhaustive-deps
  // A new mark bumps the data version once a day, so the outlook page counts today's hint too;
  // today's hint itself stays, since only the days before count towards it.
  const markShown = useCallback(() => {
    if (markTomorrowHint(getDb(), today)) useDataVersion.getState().bump();
  }, [today]);
  const result = active && state.today === today ? state.result : null;
  return { result: result && !enabled ? { ...result, hint: null } : result, markShown };
}
