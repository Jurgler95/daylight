import { isRunningInExpoGo } from 'expo';
import { Platform } from 'react-native';
import type * as HealthConnectTypes from 'react-native-health-connect';

import type { HealthDayInput } from '@/db/repositories/health';
import { addDaysToDateString, toLocalDate, type DateString } from '@/lib/dates';

import { bucketValues, mergeReadings, sleepMinutesByDay, type DayBucket, type SleepSessionLike } from './days';

/**
 * Health Connect, read only. The library is required lazily: it is a native module that Expo Go and
 * Jest do not have, and every entry point degrades to "not available".
 */

type HealthConnectModule = typeof HealthConnectTypes;

/** The four kinds of data Daylight reads. Nothing is ever written, see `app.json`. */
export const HEALTH_RECORD_TYPES = ['Steps', 'SleepSession', 'RestingHeartRate', 'ExerciseSession'] as const;
export type HealthRecordType = (typeof HEALTH_RECORD_TYPES)[number];

let cached: HealthConnectModule | null | undefined;
let initialised = false;

function load(): HealthConnectModule | null {
  if (cached !== undefined) return cached;
  if (Platform.OS !== 'android' || isRunningInExpoGo()) {
    cached = null;
    return cached;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('react-native-health-connect') as HealthConnectModule;
  } catch {
    cached = null;
  }
  return cached;
}

async function ready(): Promise<HealthConnectModule | null> {
  const module = load();
  if (!module) return null;
  if (!initialised) initialised = await module.initialize();
  return initialised ? module : null;
}

/**
 * `unsupported`: not Android, or a build without the native module (Expo Go).
 * `missing`: Health Connect is not on the device. `update`: it needs an update first.
 */
export type HealthStatus = 'available' | 'unsupported' | 'missing' | 'update';

export async function healthStatus(): Promise<HealthStatus> {
  const module = load();
  if (!module) return 'unsupported';
  try {
    const status = await module.getSdkStatus();
    if (status === module.SdkAvailabilityStatus.SDK_AVAILABLE) return 'available';
    if (status === module.SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) return 'update';
    return 'missing';
  } catch {
    return 'unsupported';
  }
}

/** Kinds of data the person allowed; reading any other kind would throw. */
export async function grantedTypes(): Promise<Set<HealthRecordType>> {
  const module = await ready();
  if (!module) return new Set();
  const granted = await module.getGrantedPermissions();
  return new Set(
    granted
      .filter((permission) => permission.accessType === 'read')
      .map((permission) => permission.recordType as string)
      .filter((type): type is HealthRecordType => (HEALTH_RECORD_TYPES as readonly string[]).includes(type)),
  );
}

/**
 * Shows the Health Connect dialog for the four kinds of data and for older data. Whether older data
 * was allowed cannot be read back: the library leaves that permission out of its answer.
 */
export async function requestAccess(): Promise<Set<HealthRecordType>> {
  const module = await ready();
  if (!module) return new Set();
  await module.requestPermission([
    ...HEALTH_RECORD_TYPES.map((recordType) => ({ accessType: 'read' as const, recordType })),
    { accessType: 'read', recordType: 'ReadHealthDataHistory' },
  ]);
  return grantedTypes();
}

export function openHealthConnect(): void {
  load()?.openHealthConnectSettings();
}

/** Gives every permission back. On Android 14+ this only takes effect once the app restarts. */
export async function revokeAccess(): Promise<void> {
  const module = await ready();
  if (!module) return;
  await module.revokeAllPermissions();
}

/** Local midnight at the start of `day` as an instant, which the library turns back into local time. */
function startOf(day: DateString): string {
  return toLocalDate(day, '00:00').toISOString();
}

async function dailyBuckets(module: HealthConnectModule, recordType: HealthRecordType, from: DateString, to: DateString): Promise<DayBucket[]> {
  const buckets = await module.aggregateGroupByPeriod({
    recordType,
    timeRangeFilter: { operator: 'between', startTime: startOf(from), endTime: startOf(addDaysToDateString(to, 1)) },
    timeRangeSlicer: { period: 'DAYS', length: 1 },
  });
  return buckets as unknown as DayBucket[];
}

/** Sleep that ends on a day in the window; it may start the evening before. */
async function sleepSessions(module: HealthConnectModule, from: DateString, to: DateString): Promise<SleepSessionLike[]> {
  const sessions: SleepSessionLike[] = [];
  let pageToken: string | undefined;
  do {
    const page = await module.readRecords('SleepSession', {
      timeRangeFilter: { operator: 'between', startTime: startOf(addDaysToDateString(from, -1)), endTime: startOf(addDaysToDateString(to, 1)) },
      pageSize: 1000,
      pageToken,
    });
    sessions.push(...page.records);
    pageToken = page.pageToken || undefined;
  } while (pageToken);
  return sessions;
}

/** Everything allowed for the days `from`..`to`, one row per day with data. */
export async function readHealthDays(from: DateString, to: DateString, types: ReadonlySet<HealthRecordType>): Promise<HealthDayInput[]> {
  const module = await ready();
  if (!module) throw new Error('Health Connect ist nicht verfügbar');
  const none = new Map<DateString, number>();
  const number = (value: unknown) => (typeof value === 'number' ? value : null);

  const steps = types.has('Steps') ? bucketValues(await dailyBuckets(module, 'Steps', from, to), (r) => number(r.COUNT_TOTAL)) : none;
  const restingHr = types.has('RestingHeartRate')
    ? bucketValues(await dailyBuckets(module, 'RestingHeartRate', from, to), (r) => number(r.BPM_AVG))
    : none;
  const exerciseMinutes = types.has('ExerciseSession')
    ? bucketValues(await dailyBuckets(module, 'ExerciseSession', from, to), (r) => {
        const seconds = number((r.EXERCISE_DURATION_TOTAL as { inSeconds?: unknown } | undefined)?.inSeconds);
        return seconds === null ? null : seconds / 60;
      })
    : none;
  const sleepMinutes = types.has('SleepSession') ? sleepMinutesByDay(await sleepSessions(module, from, to)) : none;

  return mergeReadings(from, to, { steps, sleepMinutes, restingHr, exerciseMinutes });
}
