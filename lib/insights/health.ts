import type { HealthDay } from '@/db/schema';

import type { InsightDay } from './days';
import { mean, median } from './stats';

/** Resting pulse within this many bpm of the median counts as usual. */
export const HR_USUAL_BPM = 2;

/** Below this many days a band shows only its count, no mean. */
export const MIN_BAND_DAYS = 3;

export interface HealthBand {
  /** Key of the label in `insights.health.bands`. */
  key: string;
  /** Mean of the day means, null below `MIN_BAND_DAYS`. */
  mean: number | null;
  days: number;
}

export interface HealthMood {
  /** Sleep that ended on the day, i.e. the night before it. */
  sleep: HealthBand[];
  steps: HealthBand[];
  /** Empty when no day in the range has exercise on record. */
  exercise: HealthBand[];
  /** Below, around and above the usual resting pulse of the range; empty without pulse values. */
  restingHr: HealthBand[];
  /** Around the median: `[low, high]` bpm, both ends inside the usual band. Null without pulse values. */
  hrBounds: [low: number, high: number] | null;
  /** Days in the range with both an entry and some health data. */
  pairedDays: number;
}

interface BandDef {
  key: string;
  /** Upper bound, exclusive. */
  below: number;
}

const SLEEP_BANDS: BandDef[] = [
  { key: 'sleepUnder6', below: 6 * 60 },
  { key: 'sleep6to7', below: 7 * 60 },
  { key: 'sleep7to8', below: 8 * 60 },
  { key: 'sleepOver8', below: Infinity },
];

const STEP_BANDS: BandDef[] = [
  { key: 'stepsUnder5k', below: 5_000 },
  { key: 'steps5to10k', below: 10_000 },
  { key: 'stepsOver10k', below: Infinity },
];

function band(key: string, values: number[]): HealthBand {
  return { key, mean: values.length >= MIN_BAND_DAYS ? mean(values) : null, days: values.length };
}

function bands(defs: readonly BandDef[], pairs: readonly [value: number, mood: number][]): HealthBand[] {
  const buckets = defs.map(() => [] as number[]);
  for (const [value, mood] of pairs) {
    const index = defs.findIndex((def) => value < def.below);
    buckets[index]?.push(mood);
  }
  return defs.map((def, i) => band(def.key, buckets[i] ?? []));
}

/**
 * Mood of the diary days against sleep, steps, exercise and resting pulse. Only days with an entry and a value
 * count; the numbers describe the diary and say nothing about cause and effect.
 */
export function healthMood(days: readonly InsightDay[], health: readonly HealthDay[]): HealthMood {
  const byDate = new Map(health.map((row) => [row.date, row]));
  const sleep: [number, number][] = [];
  const steps: [number, number][] = [];
  const withExercise: number[] = [];
  const withoutExercise: number[] = [];
  const pulse: [number, number][] = [];
  let pairedDays = 0;
  for (const day of days) {
    const row = byDate.get(day.date);
    if (!row) continue;
    pairedDays += 1;
    if (row.sleep_minutes !== null) sleep.push([row.sleep_minutes, day.mean]);
    if (row.steps !== null) steps.push([row.steps, day.mean]);
    if (row.resting_hr !== null) pulse.push([row.resting_hr, day.mean]);
    if (row.exercise_minutes !== null && row.exercise_minutes > 0) withExercise.push(day.mean);
    else withoutExercise.push(day.mean);
  }
  const usual = median(pulse.map(([value]) => value));
  const hrBounds: [number, number] | null = usual === null ? null : [Math.round(usual) - HR_USUAL_BPM, Math.round(usual) + HR_USUAL_BPM];
  const hrBands: BandDef[] = hrBounds
    ? [
        { key: 'hrLow', below: hrBounds[0] },
        { key: 'hrUsual', below: hrBounds[1] + 1 },
        { key: 'hrHigh', below: Infinity },
      ]
    : [];
  return {
    sleep: sleep.length ? bands(SLEEP_BANDS, sleep) : [],
    steps: steps.length ? bands(STEP_BANDS, steps) : [],
    exercise: withExercise.length ? [band('exerciseWith', withExercise), band('exerciseWithout', withoutExercise)] : [],
    restingHr: pulse.length ? bands(hrBands, pulse) : [],
    hrBounds,
    pairedDays,
  };
}
