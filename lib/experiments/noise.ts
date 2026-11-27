import { addDaysToDateString, daysBetween, type DateString } from '@/lib/dates';

/**
 * Is a difference larger than the usual ups and downs? Measured on the person's own history, not
 * with a test or a fixed threshold: on every day `s` before the experiment, take the stretch of
 * "Davor" length right before `s` and the stretch of experiment length from `s` on, and count how
 * often these two differed at least as much as the real pair. Only when that was rare does the app
 * say "larger than usual". It describes the diary and never claims a cause.
 *
 * Neighbouring days `s` share almost all their days and are no independent cases, so how much
 * history there is goes by the span the days `s` cover, not by how many there are.
 */

/** A difference this rare or rarer in the history counts as larger than usual. Same for every value. */
export const NOISE_SHARE = 0.1;
/** The days `s` cover at least this many times "Davor" plus experiment: a verdict, marked preliminary. */
export const NOISE_SPAN_PRELIMINARY = 2;
/** ... and at least this many times: a full verdict. */
export const NOISE_SPAN_FULL = 4;
/** At most this many days `s`, the latest ones. */
export const NOISE_MAX_DAYS = 730;

export type NoiseVerdict =
  /** Too little history before the experiment to compare with. */
  | { kind: 'unjudgeable' }
  | {
      /** `larger`: the difference was rare in the history; `usual`: it lies within the usual ups and downs. */
      kind: 'larger' | 'usual';
      /** 0..1: share of the days `s` with a difference at least this large. */
      share: number;
      /** The history covers only between `NOISE_SPAN_PRELIMINARY` and `NOISE_SPAN_FULL` times the lengths. */
      preliminary: boolean;
      /** Days `s` that counted. */
      pairs: number;
    };

export interface NoiseInput {
  /** A value per day; days without one are missing. Any days after the experiment are ignored. */
  series: ReadonlyMap<string, number>;
  /** First day of the experiment. */
  start: DateString;
  /** Length of "Davor" (`Lb`), already shortened to what the diary gives. */
  beforeLength: number;
  /** Length of "Im Experiment" (`Le`). */
  duringLength: number;
  /** Days with a value each stretch needs. */
  minDays: number;
}

export interface NoiseResult {
  /** Mean in the experiment minus mean before. */
  difference: number;
  before: number;
  during: number;
  verdict: NoiseVerdict;
}

/**
 * Null when the real pair already has fewer than `minDays` days with a value on a side: then the
 * value is not compared at all. Linear in the length of the history (running sums).
 */
export function noiseCheck({ series, start, beforeLength: lb, duringLength: le, minDays }: NoiseInput): NoiseResult | null {
  if (lb <= 0 || le <= 0) return null;
  let first: string | null = null;
  for (const date of series.keys()) if (first === null || date < first) first = date;
  if (first === null || first >= start) return null;

  // Dense days from the first value to the last day of the experiment, with running sums.
  const origin = first as DateString;
  const startIndex = daysBetween(origin, start);
  const length = startIndex + le;
  const sum = new Float64Array(length + 1);
  const n = new Int32Array(length + 1);
  for (let i = 0; i < length; i++) {
    const value = series.get(addDaysToDateString(origin, i));
    sum[i + 1] = sum[i]! + (value ?? 0);
    n[i + 1] = n[i]! + (value === undefined ? 0 : 1);
  }
  /** Mean over the days [from, to) of the dense row, or null with fewer than `minDays` values. */
  const meanOf = (from: number, to: number): number | null => {
    const count = n[to]! - n[from]!;
    return count >= minDays ? (sum[to]! - sum[from]!) / count : null;
  };

  const before = meanOf(Math.max(0, startIndex - lb), startIndex);
  const during = meanOf(startIndex, startIndex + le);
  if (before === null || during === null) return null;
  const difference = during - before;

  // A day `s` counts when its first stretch starts on or after the first value and its second ends
  // on the day before the start at the latest, so no pair ever reaches into the experiment.
  const last = startIndex - le;
  const firstDay = Math.max(lb, last - NOISE_MAX_DAYS + 1);
  let valid = 0;
  let asLarge = 0;
  let firstValid = -1;
  let lastValid = -1;
  const threshold = Math.abs(difference) - 1e-9;
  for (let s = firstDay; s <= last; s++) {
    const a = meanOf(s - lb, s);
    const b = meanOf(s, s + le);
    if (a === null || b === null) continue;
    valid++;
    if (firstValid < 0) firstValid = s;
    lastValid = s;
    if (Math.abs(b - a) >= threshold) asLarge++;
  }

  const span = valid > 0 ? lastValid - firstValid + 1 : 0;
  const unit = lb + le;
  if (span < NOISE_SPAN_PRELIMINARY * unit) return { difference, before, during, verdict: { kind: 'unjudgeable' } };
  const share = asLarge / valid;
  return {
    difference,
    before,
    during,
    verdict: { kind: share <= NOISE_SHARE ? 'larger' : 'usual', share, preliminary: span < NOISE_SPAN_FULL * unit, pairs: valid },
  };
}
