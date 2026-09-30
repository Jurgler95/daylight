import type { HealthDayInput } from '@/db/repositories/health';
import { addDaysToDateString, startOfMonthString, toDateString, type DateString } from '@/lib/dates';

/**
 * Pure conversion of what Health Connect returns into one row per day. No import of the library, so
 * the same code runs in Jest and on the device.
 */

/** One day of `aggregateGroupByPeriod`: the bucket starts at local midnight ("2026-09-01T00:00"). */
export interface DayBucket {
  startTime: string;
  result: { dataOrigins?: readonly string[] } & Record<string, unknown>;
}

export interface SleepStageLike {
  startTime: string;
  endTime: string;
  stage: number;
}

export interface SleepSessionLike {
  startTime: string;
  endTime: string;
  endZoneOffset?: { totalSeconds: number } | null;
  stages?: readonly SleepStageLike[];
}

/** `SleepStageType.AWAKE` and `OUT_OF_BED`: time in the session that is not sleep. */
const NOT_ASLEEP = new Set([1, 3]);

/**
 * Value per day from aggregate buckets. A bucket without any data origin had nothing that day; the
 * library then reports 0, which would read as "0 steps" instead of "no data".
 */
export function bucketValues(buckets: readonly DayBucket[], pick: (result: DayBucket['result']) => number | null | undefined): Map<DateString, number> {
  const values = new Map<DateString, number>();
  for (const bucket of buckets) {
    if (!bucket.result.dataOrigins?.length) continue;
    const value = pick(bucket.result);
    if (typeof value !== 'number' || !Number.isFinite(value)) continue;
    values.set(bucket.startTime.slice(0, 10) as DateString, value);
  }
  return values;
}

/** The calendar day an instant falls on, in the offset the device recorded, else in local time. */
export function localDay(instant: string, offsetSeconds?: number | null): DateString {
  const ms = Date.parse(instant);
  if (typeof offsetSeconds === 'number') return new Date(ms + offsetSeconds * 1000).toISOString().slice(0, 10) as DateString;
  return toDateString(new Date(ms));
}

type Interval = [start: number, end: number];

function asleepIntervals(session: SleepSessionLike): Interval[] {
  const stages = session.stages ?? [];
  const source = stages.length > 0 ? stages.filter((stage) => !NOT_ASLEEP.has(stage.stage)) : [session];
  return source.map((part): Interval => [Date.parse(part.startTime), Date.parse(part.endTime)]).filter(([start, end]) => end > start);
}

/** Length of the union, so two apps recording the same night do not count it twice. */
function unionLength(intervals: Interval[]): number {
  const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
  let total = 0;
  let current: Interval | null = null;
  for (const interval of sorted) {
    if (current && interval[0] <= current[1]) {
      current[1] = Math.max(current[1], interval[1]);
      continue;
    }
    if (current) total += current[1] - current[0];
    current = [interval[0], interval[1]];
  }
  if (current) total += current[1] - current[0];
  return total;
}

/**
 * Minutes asleep per day. Sleep belongs to the day it ends on: the night from Monday to Tuesday is
 * Tuesday's sleep, the night before the day it shapes. Naps count on their day as well.
 */
export function sleepMinutesByDay(sessions: readonly SleepSessionLike[]): Map<DateString, number> {
  const byDay = new Map<DateString, Interval[]>();
  for (const session of sessions) {
    const day = localDay(session.endTime, session.endZoneOffset?.totalSeconds);
    const list = byDay.get(day) ?? [];
    list.push(...asleepIntervals(session));
    byDay.set(day, list);
  }
  const minutes = new Map<DateString, number>();
  for (const [day, intervals] of byDay) {
    const total = Math.round(unionLength(intervals) / 60_000);
    if (total > 0) minutes.set(day, total);
  }
  return minutes;
}

export interface HealthReadings {
  steps: Map<DateString, number>;
  sleepMinutes: Map<DateString, number>;
  restingHr: Map<DateString, number>;
  exerciseMinutes: Map<DateString, number>;
}

/** One row per day in `from`..`to` that has at least one value. */
export function mergeReadings(from: DateString, to: DateString, readings: HealthReadings): HealthDayInput[] {
  const days: HealthDayInput[] = [];
  const round = (value: number | undefined) => (value === undefined ? null : Math.round(value));
  for (let day = from; day <= to; day = addDaysToDateString(day, 1)) {
    const row: HealthDayInput = {
      date: day,
      steps: round(readings.steps.get(day)),
      sleep_minutes: round(readings.sleepMinutes.get(day)),
      resting_hr: round(readings.restingHr.get(day)),
      exercise_minutes: round(readings.exerciseMinutes.get(day)),
    };
    if (row.steps !== null || row.sleep_minutes !== null || row.resting_hr !== null || row.exercise_minutes !== null) days.push(row);
  }
  return days;
}

/** Both ends included. */
export interface SyncWindow {
  from: DateString;
  to: DateString;
  /** True for windows of the backfill, which move `health_synced_from` back once saved. */
  backfill: boolean;
}

/** Every sync reads at least this many days up to today: watches hand over their data late. */
export const RECENT_DAYS = 7;
/** Without entries the backfill still reaches this far, so a new diary already has something. */
export const MIN_BACKFILL_DAYS = 30;

export interface SyncPlanInput {
  today: DateString;
  /** First day of the diary, the backfill goes back to it. */
  firstEntry: DateString | null;
  /** Oldest day the backfill has read, null before the first run. */
  syncedFrom: DateString | null;
  /** Day of the last finished sync, so days between then and now are read again. */
  lastSyncDay: DateString | null;
}

/** `from`..`to` cut at month starts, newest first. */
function monthChunks(from: DateString, to: DateString, backfill: boolean): SyncWindow[] {
  const windows: SyncWindow[] = [];
  let end = to;
  while (end >= from) {
    const monthStart = startOfMonthString(end);
    const start = monthStart > from ? monthStart : from;
    windows.push({ from: start, to: end, backfill });
    end = addDaysToDateString(start, -1);
  }
  return windows;
}

/**
 * What one sync reads, newest first: the last days up to today (reaching back to the last finished
 * sync if the app was not opened for a while), then, month by month, whatever of the backfill is
 * still missing. Every window is saved on its own, so an interrupted backfill resumes where it
 * stopped.
 */
export function planSync({ today, firstEntry, syncedFrom, lastSyncDay }: SyncPlanInput): SyncWindow[] {
  let recentFrom = addDaysToDateString(today, 1 - RECENT_DAYS);
  if (lastSyncDay) {
    const sinceLast = addDaysToDateString(lastSyncDay, 1 - RECENT_DAYS);
    if (sinceLast < recentFrom) recentFrom = sinceLast;
  }
  const minimum = addDaysToDateString(today, 1 - MIN_BACKFILL_DAYS);
  const target = firstEntry && firstEntry < minimum ? firstEntry : minimum;

  const windows = monthChunks(recentFrom, today, false);
  const backfillEnd = addDaysToDateString(syncedFrom && syncedFrom < recentFrom ? syncedFrom : recentFrom, -1);
  if (backfillEnd >= target) windows.push(...monthChunks(target, backfillEnd, true));
  return windows;
}

/** Whether the backfill still has something to read; then a sync runs even inside the pause. */
export function backfillPending(input: SyncPlanInput): boolean {
  return planSync(input).some((window) => window.backfill);
}

/** Minutes of pause between two syncs that only refresh the last days. */
export const SYNC_PAUSE_MINUTES = 15;

export function withinPause(lastSyncAt: string | null, now: Date): boolean {
  if (!lastSyncAt) return false;
  const last = Date.parse(lastSyncAt);
  return Number.isFinite(last) && now.getTime() - last < SYNC_PAUSE_MINUTES * 60_000 && now.getTime() >= last;
}
