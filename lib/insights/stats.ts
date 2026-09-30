/**
 * How strongly small samples are pulled towards "no difference": an estimate from n days counts
 * with n / (n + k). With k = 10 an activity on 6 days keeps 38 % of its difference, one on 79 days
 * 89 %. Shared by activity effects, weekday effects and everything ranked by them, and meant to be
 * reused by the outlook (Phase 4), so both speak about the same numbers.
 */
export const SHRINK_K = 10;

/** Weight of an estimate from `n` observations; 0 for none. */
export function shrinkFactor(n: number, k: number = SHRINK_K): number {
  return n <= 0 ? 0 : n / (n + k);
}

export function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  let sum = 0;
  for (const value of values) sum += value;
  return sum / values.length;
}

/**
 * Population standard deviation: how far the values of this very set lie from their mean. The
 * insights describe what happened, they do not estimate a larger population, so no n - 1.
 */
export function standardDeviation(values: readonly number[]): number | null {
  const m = mean(values);
  if (m === null) return null;
  let sum = 0;
  for (const value of values) sum += (value - m) ** 2;
  return Math.sqrt(sum / values.length);
}

/** Middle value, the mean of the two middle ones for an even count. */
export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}
