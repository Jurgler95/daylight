import { useCallback, useEffect, useMemo } from 'react';
import { create } from 'zustand';

import { getDb } from '@/db';
import { listHealthDays } from '@/db/repositories/health';
import { clearTomorrowHint, listTomorrowHints, listTomorrowSnapshots, markTomorrowHint } from '@/db/repositories/tomorrowHints';
import { addDaysToDateString, type DateString } from '@/lib/dates';
import type { InsightDay, ScaleFacts } from '@/lib/insights';
import { readInsightDays } from '@/lib/insights/useInsights';
import { cached, useDataVersion, useQuery } from '@/lib/store/dataVersion';
import { useSettingsStore } from '@/lib/store/settingsStore';

import { tomorrowSteps, WINDOW_DAYS, type BodyByDate, type GoodTomorrow, type TomorrowResult } from './tomorrow';

/** Everything the hint depends on: the day, every day's mood, activities and scale values, the scales, sleep and steps, and the hint days. */
export function tomorrowSignature(days: readonly InsightDay[], scales: readonly ScaleFacts[], body: BodyByDate, shown: readonly string[], today: DateString): string {
  const dayPart = days
    .map((day) => `${day.date}:${day.mean}:${[...day.activities].sort((a, b) => a - b).join(',')}:${[...day.scales].map(([id, v]) => `${id}=${v.sum}/${v.count}`).join(',')}`)
    .join('|');
  // Today's steps still grow with every sync and are not used until tomorrow, so they stay out.
  const bodyPart = [...body].map(([date, b]) => `${date}:${b.sleep}:${date >= today ? '' : b.steps}`).join('|');
  return `${today}#${shown.join(',')}#${scales.map((scale) => `${scale.id}:${scale.kind}:${scale.min}:${scale.max}:${scale.decimals ?? 0}`).join(',')}#${bodyPart}#${dayPart}`;
}

interface Finished {
  signature: string;
  result: TomorrowResult;
}

interface TomorrowState {
  /**
   * The last finished result per day the hint is worked out for. It stands in while a newer one
   * for the same day is computed.
   */
  byDay: Readonly<Record<string, Finished>>;
}

/**
 * The backtest refits the model about fifty times a year of diary, so like the outlook's it runs
 * outside rendering in slices of a few milliseconds, once per distinct diary, shared by every screen.
 * Runs for different days queue up instead of cancelling each other (around midnight both may be
 * asked for); a newer run for the same day replaces the older.
 */
const useTomorrowStore = create<TomorrowState>(() => ({ byDay: {} }));
const SLICE_MS = 12;
interface Job {
  signature: string;
  input: Parameters<typeof tomorrowSteps>[0];
}
let queue: Job[] = [];
let running: { job: Job; cancelled: boolean } | null = null;

function startNext(): void {
  const job = queue.shift();
  if (!job) return;
  const current = { job, cancelled: false };
  running = current;
  const steps = tomorrowSteps(job.input);
  const step = () => {
    if (current.cancelled) return;
    const started = Date.now();
    while (Date.now() - started < SLICE_MS) {
      const next = steps.next();
      if (next.done) {
        running = null;
        const { byDay } = useTomorrowStore.getState();
        // Only the day the app looks at and the day before it are ever asked for.
        const kept = Object.fromEntries(Object.entries(byDay).filter(([day]) => day >= addDaysToDateString(job.input.today, -1)));
        useTomorrowStore.setState({ byDay: { ...kept, [job.input.today]: { signature: job.signature, result: next.value } } });
        startNext();
        return;
      }
    }
    setTimeout(step, 0);
  };
  setTimeout(step, 0);
}

function run(input: Parameters<typeof tomorrowSteps>[0], signature: string): void {
  if (running?.job.signature === signature || queue.some((job) => job.signature === signature)) return;
  if (useTomorrowStore.getState().byDay[input.today]?.signature === signature) return;
  // A newer diary for the same day makes the older run pointless.
  queue = queue.filter((job) => job.input.today !== input.today);
  if (running && running.job.input.today === input.today) {
    running.cancelled = true;
    running = null;
  }
  queue.push({ signature, input });
  if (!running) startNext();
}

/** Tests: a clean slate between diaries. */
export function resetTomorrow(): void {
  if (running) running.cancelled = true;
  running = null;
  queue = [];
  useTomorrowStore.setState({ byDay: {} });
}

/** Sleep and steps by day, from whatever Health Connect delivered; empty without it. */
function readBody(): BodyByDate {
  return cached('tomorrowBody', () => new Map(cached('healthDays', () => listHealthDays(getDb())).map((row) => [row.date, { sleep: row.sleep_minutes, steps: row.steps }])));
}

export interface TomorrowView {
  /** Null while computing for a new day. */
  result: TomorrowResult | null;
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
  const finished = useTomorrowStore((state) => state.byDay[today]);
  useEffect(() => {
    if (signature) run({ days, scales, today, shown, body }, signature);
  }, [signature]); // eslint-disable-line react-hooks/exhaustive-deps
  const result = active && finished ? finished.result : null;
  return { result: result && !enabled ? { ...result, hint: null } : result };
}

/** The stored hint back from JSON; null for anything that is not one (an older or broken row). */
export function parseStoredHint(json: string | undefined): GoodTomorrow | null {
  if (!json) return null;
  try {
    const value = JSON.parse(json) as Partial<GoodTomorrow> | null;
    if (!value || typeof value.date !== 'string' || typeof value.level !== 'number' || !Array.isArray(value.reasons)) return null;
    return value as GoodTomorrow;
  } catch {
    return null;
  }
}

export interface HintOnToday {
  hint: GoodTomorrow | null;
  /**
   * True on a morning before today's entry, while yesterday's hint is stored: the hint is then
   * yesterday's, for today, exactly as it was last on screen. It counted yesterday, so it counts nothing now.
   */
  morning: boolean;
  /** Call while the hint is on screen: counts the day once and keeps the hint as it reads for the morning after. */
  markShown: () => void;
}

/**
 * The hint "Heute" shows. Normally the one for tomorrow, from today's entry. Before today's entry,
 * on a day yesterday's hint pointed at, that one again from what was stored when it was on screen,
 * so the morning card appears at once and says what the evening said.
 */
export function useHintOnToday(today: DateString, scales: readonly ScaleFacts[]): HintOnToday {
  const yesterday = addDaysToDateString(today, -1);
  const hasEntry = useQuery(() => readInsightDays().some((day) => day.date === today), [today]);
  const stored = useQuery(() => listTomorrowSnapshots(getDb(), yesterday), [yesterday]);
  const fromYesterday = useMemo(() => parseStoredHint(stored.get(yesterday)), [stored, yesterday]);
  const enabled = useSettingsStore((s) => s.settings?.outlook_enabled ?? true);
  const morning = enabled && !hasEntry && fromYesterday !== null;
  const { result } = useGoodTomorrow(today, scales);
  const hint = morning ? fromYesterday : (result?.hint ?? null);
  const json = hint && !morning ? JSON.stringify(hint) : null;

  // Today's hint gone again, say after the entry was changed that evening: tomorrow morning has
  // nothing to show and no notification to send. The day still counts towards the two weeks.
  const gone = result !== null && result.hint === null && stored.has(today);
  useEffect(() => {
    if (gone && clearTomorrowHint(getDb(), today)) useDataVersion.getState().bump();
  }, [gone, today]);

  // A new mark, or a hint that reads differently now, bumps the data version, so the outlook page
  // counts today's hint too and the morning notification is planned.
  const markShown = useCallback(() => {
    if (json && markTomorrowHint(getDb(), today, json)) useDataVersion.getState().bump();
  }, [json, today]);
  return { hint, morning, markShown };
}
