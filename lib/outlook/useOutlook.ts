import { useEffect, useMemo } from 'react';
import { create } from 'zustand';

import { getDb } from '@/db';
import { listPlannedActivities } from '@/db/repositories/plans';
import { addDaysToDateString, type DateString } from '@/lib/dates';
import type { MoodLevel } from '@/db/schema';
import { byDate, type InsightDay } from '@/lib/insights';
import { readInsightDays } from '@/lib/insights/useInsights';
import { useQuery } from '@/lib/store/dataVersion';
import { useSettingsStore } from '@/lib/store/settingsStore';

import { backtestOrigins, casesForOrigin, HORIZONS, mostFrequentLevel, originKeys, scoreBacktest, type BacktestCase, type BacktestResult } from './backtest';
import { buildOutlook, type Outlook } from './outlook';
import { plansByDay } from './plans';

/** What the backtest saw: every day's date, mean and activities. Plans and notes do not matter to it. */
export function daysSignature(days: readonly InsightDay[]): string {
  return days.map((day) => `${day.date}:${day.mean}:${[...day.activities].sort((a, b) => a - b).join(',')}`).join('|');
}

interface BacktestState {
  signature: string | null;
  result: BacktestResult | null;
}

/**
 * The backtest refits the model for every past day: a few hundred milliseconds for a year on a
 * laptop, several times that on a phone. So it runs outside rendering, in slices of a few
 * milliseconds between frames, once per distinct diary, and every screen shares the result. Until a
 * new one is ready the previous result stands in: one more entry hardly moves it. The cases of each
 * cut-off are kept by `originKeys`, so saving today's entry only refits the last week of cut-offs.
 */
const useBacktestStore = create<BacktestState>(() => ({ signature: null, result: null }));

/** Longest stretch the backtest may hold the JavaScript thread before it yields. */
const SLICE_MS = 12;
const caseCache = new Map<string, BacktestCase[]>();
let job: { signature: string; cancelled: boolean } | null = null;

function runBacktest(days: readonly InsightDay[], signature: string): void {
  if (job?.signature === signature || useBacktestStore.getState().signature === signature) return;
  if (job) job.cancelled = true;
  const current = { signature, cancelled: false };
  job = current;
  const origins = backtestOrigins(days);
  const keys = originKeys(days, origins);
  const lookup = byDate(days);
  const collected: BacktestCase[][] = [];
  let index = 0;
  const step = () => {
    if (current.cancelled) return;
    const started = Date.now();
    while (index < origins.length && Date.now() - started < SLICE_MS) {
      const key = keys[index]!;
      let cases = caseCache.get(key);
      if (!cases) {
        cases = casesForOrigin(days, origins[index]!, lookup);
        caseCache.set(key, cases);
      }
      collected.push(cases);
      index += 1;
    }
    if (index < origins.length) {
      setTimeout(step, 0);
      return;
    }
    const used = new Set(keys);
    for (const key of caseCache.keys()) if (!used.has(key)) caseCache.delete(key);
    job = null;
    useBacktestStore.setState({ signature, result: scoreBacktest(collected.flat()) });
  };
  setTimeout(step, 0);
}

/** Tests: whether no backtest is running, and a clean slate between diaries. */
export function backtestIdle(): boolean {
  return job === null;
}

export function resetBacktest(): void {
  if (job) job.cancelled = true;
  job = null;
  caseCache.clear();
  useBacktestStore.setState({ signature: null, result: null });
}

function useBacktest(days: readonly InsightDay[]): BacktestResult | null {
  const signature = useMemo(() => daysSignature(days), [days]);
  const result = useBacktestStore((s) => s.result);
  useEffect(() => runBacktest(days, signature), [signature, days]);
  return result;
}

export interface OutlookView {
  /** The switch "Ausblick zeigen". */
  enabled: boolean;
  /** Null while the first backtest is still running. */
  outlook: Outlook | null;
  /** The naive comparison "most frequent mood", named when the outlook steps back. */
  modeLevel: MoodLevel;
}

/** The seven days after `today`, with plans; recomputed when data, plans or the day change. */
export function useOutlook(today: DateString): OutlookView {
  const enabled = useSettingsStore((s) => s.settings?.outlook_enabled ?? true);
  const days = useQuery(() => readInsightDays(), []);
  const plans = useQuery(
    () => plansByDay(listPlannedActivities(getDb(), addDaysToDateString(today, 1), addDaysToDateString(today, HORIZONS.length))),
    [today],
  );
  const result = useBacktest(days);
  const outlook = useMemo(() => (result ? buildOutlook({ days, today, plans, backtest: result }) : null), [days, today, plans, result]);
  const modeLevel = useMemo(() => mostFrequentLevel(days) as MoodLevel, [days]);
  return { enabled, outlook, modeLevel };
}

/** Every plan from tomorrow on, for the calendar's small activity icons. */
export function useFuturePlans(today: DateString): ReadonlyMap<DateString, number[]> {
  return useQuery(() => plansByDay(listPlannedActivities(getDb(), addDaysToDateString(today, 1))), [today]);
}
