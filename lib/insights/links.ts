import type { HealthDay } from '@/db/schema';
import { addDaysToDateString, daysBetween, type DateString } from '@/lib/dates';

import type { InsightDay } from './days';
import { settledValue } from './healthStats';
import { scaleDayValue, type ScaleFacts } from './scales';

/**
 * Which activities, scales and body values go together with better or worse days, tested so that
 * as little as possible is claimed by chance.
 *
 * 1. Every factor becomes a number per day with an entry (activity: 0 or 1; scale, sleep, steps:
 *    a z-score cut off at 3), once for the same day (lag 0) and once for the day after (lag 1).
 * 2. Mood and every factor are turned into deviations from their own slow level: weekday means
 *    are taken out, then a triangular moving average over 10 calendar days to either side. Phases
 *    of life, seasons, the weekly rhythm and tags that only exist for a while leave both sides
 *    before anything is compared.
 * 3. Each factor is tested with a small regression of mood on the factor plus the factors directly
 *    linked to it: those that go together with it more than their common relation to mood
 *    explains. That keeps out tags that merely describe the mood and brings in what a factor
 *    stands in for.
 * 4. A factor counts only if it holds on its own and after that adjustment, with the same sign.
 *    The weaker of the two decides.
 * 5. All tests of a diary share one error budget (Bonferroni over both lags), so the chance of
 *    even one chance finding per diary is about `ALPHA`.
 *
 * Pure and deterministic. Like every insight it describes the diary: a link is not a cause.
 */

/** Half width in calendar days of the triangular trend window. */
export const TREND_HALF_WIDTH = 10;
/** An activity needs this many days with and without it. */
export const MIN_COUNT = 8;
/** A scale, a body value or a column of the day after needs this many usable days. */
export const MIN_VALUES = 20;
/** Below this many days with an entry nothing is tested. */
export const MIN_DAYS = 30;
/** |t| of the partial correlation given mood from which two factors count as directly linked. */
export const LINK_T = 3.0;
/** Adjusters per factor at most, strongest links first. */
export const MAX_LINKS = 8;
/** An adjuster is skipped if the factor would keep less than this share of its own variance. */
export const MIN_TOL = 0.3;
/** Family-wise error per diary for "stable". */
export const ALPHA = 0.1;
/** The same for "hint". */
export const ALPHA_HINT = 0.5;
/** Calendar days up to today that are looked at; nothing is measured for longer diaries. */
export const LINK_WINDOW_DAYS = 730;

export type LinkLevel = 'stable' | 'hint';
export type LinkDirection = 'up' | 'down';

/** One factor as a number per row. A flag is 0 or 1 on every row; a value may be missing (null). */
export interface LinkColumn<K> {
  key: K;
  kind: 'flag' | 'value';
  values: readonly (number | null)[];
}

/** Days with an entry, oldest first. Values of days without an entry never get in here. */
export interface LinkRows<K> {
  /** Calendar day numbers, strictly rising; only their differences and their weekday matter. */
  dayNumbers: readonly number[];
  /** The day's mean mood. */
  mood: readonly number[];
  /** In column order: this decides only between adjusters of exactly equal strength. */
  factors: readonly LinkColumn<K>[];
}

/** One tested column. */
export interface LinkTest<K> {
  key: K;
  lag: 0 | 1;
  /** From the factor on its own. */
  direction: LinkDirection;
  level: LinkLevel | null;
  /** t of the factor alone, and after adjusting for the factors linked to it. */
  t: number;
  tAdjusted: number;
  /** p times the number of tests; `level` compares it with `ALPHA` and `ALPHA_HINT`. */
  q: number;
  /** Days with the activity, or days with a value. */
  count: number;
}

/**
 * Complementary error function, which JavaScript lacks. Below 3 one minus the series of erf with
 * only positive terms, from 3 on the continued fraction. The relative error stays below 1e-10
 * (largest just under 3), far finer than any p value needs where it is compared with a threshold.
 */
export function erfc(x: number): number {
  if (x < 0) return 2 - erfc(-x);
  if (x < 3) {
    // erf(x) = 2/sqrt(pi) * exp(-x^2) * sum of 2^n x^(2n+1) / (1 * 3 * ... * (2n+1))
    let term = x;
    let sum = x;
    for (let n = 1; n < 200; n++) {
      term *= (2 * x * x) / (2 * n + 1);
      sum += term;
      if (term < sum * 1e-17) break;
    }
    return 1 - (2 / Math.sqrt(Math.PI)) * Math.exp(-x * x) * sum;
  }
  let fraction = x;
  for (let k = 60; k >= 1; k--) fraction = x + k / 2 / fraction;
  return Math.exp(-x * x) / (Math.sqrt(Math.PI) * fraction);
}

/** Two-sided p value of Student's t by Hill's normal approximation, good from 5 degrees of freedom. */
function pTwoSided(t: number, df: number): number {
  if (df < 5) return 1;
  const a = df - 0.5;
  const b = 48 * a * a;
  let z = Math.sqrt(a * Math.log(1 + (t * t) / df));
  z = z + (z ** 3 + 3 * z) / b - (4 * z ** 7 + 33 * z ** 5 + 240 * z ** 3 + 855 * z) / (10 * b * (b + 0.8 * z ** 4 + 100));
  return erfc(z / Math.sqrt(2));
}

function tFromR(r: number, df: number): number {
  const clipped = Math.max(-0.999999, Math.min(0.999999, r));
  return clipped * Math.sqrt(df / (1 - clipped * clipped));
}

/** Inverse of a small symmetric matrix by Gauss-Jordan elimination with pivoting. */
function inverse(matrix: readonly (readonly number[])[]): number[][] {
  const p = matrix.length;
  const m = matrix.map((row, i) => [...row, ...Array.from({ length: p }, (_, j) => (i === j ? 1 : 0))]);
  for (let c = 0; c < p; c++) {
    let pivot = c;
    for (let r = c + 1; r < p; r++) if (Math.abs(m[r]![c]!) > Math.abs(m[pivot]![c]!)) pivot = r;
    if (Math.abs(m[pivot]![c]!) < 1e-12) m[pivot]![c] = 1e-12;
    const swapped = m[pivot]!;
    m[pivot] = m[c]!;
    const d = swapped[c]!;
    const row = swapped.map((v) => v / d);
    m[c] = row;
    for (let r = 0; r < p; r++) {
      const f = m[r]![c]!;
      if (r !== c && f !== 0) m[r] = m[r]!.map((a, i) => a - f * row[i]!);
    }
  }
  return m.map((row) => row.slice(p));
}

type Series = (number | null)[];

/** Positive remainder, so day numbers before any epoch still sort into seven weekdays. */
const weekdayIndex = (dayNumber: number) => ((dayNumber % 7) + 7) % 7;

function weekdayResidual(values: Series, dayNumbers: readonly number[]): Series {
  const sums = [0, 0, 0, 0, 0, 0, 0];
  const counts = [0, 0, 0, 0, 0, 0, 0];
  values.forEach((value, i) => {
    if (value === null) return;
    const weekday = weekdayIndex(dayNumbers[i]!);
    sums[weekday]! += value;
    counts[weekday]! += 1;
  });
  return values.map((value, i) => {
    if (value === null) return null;
    const weekday = weekdayIndex(dayNumbers[i]!);
    return value - sums[weekday]! / counts[weekday]!;
  });
}

/** Deviation from the triangular-kernel mean of the values within the trend window, the day itself included. */
function trendResidual(values: Series, dayNumbers: readonly number[]): Series {
  const n = values.length;
  const out: Series = new Array<number | null>(n).fill(null);
  let lo = 0;
  for (let i = 0; i < n; i++) {
    while (dayNumbers[i]! - dayNumbers[lo]! > TREND_HALF_WIDTH) lo++;
    const value = values[i]!;
    if (value === null) continue;
    let weights = 0;
    let weighted = 0;
    for (let j = lo; j < n && dayNumbers[j]! - dayNumbers[i]! <= TREND_HALF_WIDTH; j++) {
      const other = values[j]!;
      if (other === null) continue;
      const weight = 1 - Math.abs(dayNumbers[j]! - dayNumbers[i]!) / (TREND_HALF_WIDTH + 1);
      weights += weight;
      weighted += weight * other;
    }
    out[i] = value - weighted / weights;
  }
  return out;
}

/** Three steps: weekday, trend, weekday again. */
function residual(values: Series, dayNumbers: readonly number[]): Series {
  return weekdayResidual(trendResidual(weekdayResidual(values, dayNumbers), dayNumbers), dayNumbers);
}

/** z-score with the population spread over the rows with a value, cut off at 3; null with too few values or no spread. */
function zScores(values: readonly (number | null)[]): Series | null {
  let count = 0;
  let sum = 0;
  for (const value of values) {
    if (value === null) continue;
    count += 1;
    sum += value;
  }
  if (count < MIN_VALUES) return null;
  const m = sum / count;
  let squares = 0;
  for (const value of values) if (value !== null) squares += (value - m) ** 2;
  const sd = Math.sqrt(squares / count);
  if (sd === 0) return null;
  return values.map((value) => (value === null ? null : Math.max(-3, Math.min(3, (value - m) / sd))));
}

function dot(a: Float64Array, b: Float64Array): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i]! * b[i]!;
  return sum;
}

interface Column<K> {
  key: K;
  lag: 0 | 1;
  values: Float64Array;
  /** Rows the column really has a value on. */
  available: number;
  count: number;
}

/**
 * The tests of one diary, every tested column with its numbers, also those below both thresholds.
 * A generator, so a caller can run it in slices: it yields after every factor, every row of the
 * matrix of products and every tested column. Returns nothing below `MIN_DAYS` rows or when the
 * mood never leaves its own slow level.
 */
export function* linkSteps<K>(rows: LinkRows<K>): Generator<void, LinkTest<K>[], void> {
  const { dayNumbers, mood } = rows;
  const n = mood.length;
  if (n < MIN_DAYS) return [];

  const columns: Column<K>[] = [];
  for (const factor of rows.factors) {
    let series: Series | null;
    let count = 0;
    if (factor.kind === 'flag') {
      for (const value of factor.values) if (value) count += 1;
      // Time before the first use of an activity counts as "not done".
      series = count >= MIN_COUNT && n - count >= MIN_COUNT ? factor.values.map((value) => (value ? 1 : 0)) : null;
    } else {
      for (const value of factor.values) if (value !== null) count += 1;
      series = zScores(factor.values);
    }
    if (!series) continue;
    const own = residual(series, dayNumbers);
    // A missing value becomes 0, "at its usual level".
    const same = new Float64Array(n);
    let available = 0;
    own.forEach((value, i) => {
      if (value === null) return;
      same[i] = value;
      available += 1;
    });
    columns.push({ key: factor.key, lag: 0, values: same, available, count });
    // The day after: the residual of the row before, and only if that is the calendar day before.
    const next = new Float64Array(n);
    let neighbours = 0;
    for (let i = 1; i < n; i++) {
      const before = own[i - 1]!;
      if (dayNumbers[i]! - dayNumbers[i - 1]! === 1 && before !== null) {
        next[i] = before;
        neighbours += 1;
      }
    }
    columns.push({ key: factor.key, lag: 1, values: next, available: neighbours, count });
    yield;
  }
  const p = columns.length;
  if (p === 0) return [];

  const y = Float64Array.from(residual([...mood], dayNumbers) as number[]);
  const syy = dot(y, y);
  if (syy <= 0) return [];
  const sxy = columns.map((column) => dot(column.values, y));
  const G: number[][] = Array.from({ length: p }, () => new Array<number>(p).fill(0));
  for (let i = 0; i < p; i++) {
    for (let j = 0; j <= i; j++) G[i]![j] = G[j]![i] = dot(columns[i]!.values, columns[j]!.values);
    yield;
  }
  const ok = columns.map((column, i) => G[i]![i]! > 1e-9 && column.available >= MIN_VALUES);
  const ry = columns.map((_, i) => (ok[i] ? sxy[i]! / Math.sqrt(G[i]![i]! * syy) : 0));

  const tested: { j: number; tAlone: number; tAdjusted: number; p: number }[] = [];
  for (let j = 0; j < p; j++) {
    if (!ok[j]) continue;
    const tAlone = tFromR(ry[j]!, n - 2);
    // Directly linked to j: goes with j beyond what mood explains, with the sign of the raw relation.
    const links: { strength: number; k: number }[] = [];
    for (let k = 0; k < p; k++) {
      if (k === j || !ok[k]) continue;
      const rjk = G[j]![k]! / Math.sqrt(G[j]![j]! * G[k]![k]!);
      if (Math.abs(rjk) > 0.97) continue;
      const partial = (rjk - ry[j]! * ry[k]!) / Math.sqrt((1 - ry[j]! ** 2) * (1 - ry[k]! ** 2));
      const tLink = tFromR(partial, n - 3);
      if (Math.abs(tLink) >= LINK_T && partial * rjk > 0) links.push({ strength: Math.abs(tLink), k });
    }
    links.sort((a, b) => b.strength - a.strength || a.k - b.k);
    const chosen: number[] = [];
    let tAdjusted = tAlone;
    for (const { k } of links) {
      if (chosen.length >= MAX_LINKS) break;
      const idx = [j, ...chosen, k];
      const m = idx.length;
      const inv = inverse(idx.map((a) => idx.map((b) => G[a]![b]! * (a === b ? 1 + 1e-6 : 1))));
      // j would be nearly determined by its adjusters.
      if (1 / (G[j]![j]! * inv[0]![0]!) < MIN_TOL) continue;
      const beta = inv.map((row) => {
        let sum = 0;
        for (let q = 0; q < m; q++) sum += row[q]! * sxy[idx[q]!]!;
        return sum;
      });
      let explained = 0;
      for (let q = 0; q < m; q++) explained += beta[q]! * sxy[idx[q]!]!;
      const se = Math.sqrt((Math.max(syy - explained, 1e-9) / (n - m - 1)) * inv[0]![0]!);
      chosen.push(k);
      tAdjusted = beta[0]! / se;
    }
    // A sign that flips under adjustment is no finding at all.
    const weaker = tAlone * tAdjusted > 0 ? Math.min(Math.abs(tAlone), Math.abs(tAdjusted)) : 0;
    tested.push({ j, tAlone, tAdjusted, p: pTwoSided(weaker, n - 2 - chosen.length) });
    yield;
  }

  const tests = tested.length;
  return tested.map(({ j, tAlone, tAdjusted, p: pValue }) => {
    const column = columns[j]!;
    const q = pValue * tests;
    return {
      key: column.key,
      lag: column.lag,
      direction: tAlone > 0 ? 'up' : 'down',
      level: q <= ALPHA ? 'stable' : q <= ALPHA_HINT ? 'hint' : null,
      t: tAlone,
      tAdjusted,
      q,
      count: column.count,
    };
  });
}

function drain<T>(steps: Generator<void, T, void>): T {
  let next = steps.next();
  while (!next.done) next = steps.next();
  return next.value;
}

/** `linkSteps` in one go. */
export function analyzeLinks<K>(rows: LinkRows<K>): LinkTest<K>[] {
  return drain(linkSteps(rows));
}

export type LinkFactor = { kind: 'activity'; id: number } | { kind: 'scale'; id: number } | { kind: 'health'; metric: 'sleep' | 'steps' };

/** A factor that goes together with better (`up`) or worse (`down`) days. */
export interface LinkFinding {
  factor: LinkFactor;
  lag: 0 | 1;
  direction: LinkDirection;
  level: LinkLevel;
  /** Days with the activity, or days with a value, among the days looked at. */
  days: number;
}

export interface Links {
  /** Days with an entry among the last `LINK_WINDOW_DAYS`; below `MIN_DAYS` nothing is tested. */
  days: number;
  /** Factors not marked as describing the mood: stable ones first, then by strength. */
  findings: LinkFinding[];
  /** Factors marked as describing the mood, tested together with all others. */
  describing: LinkFinding[];
}

/** An activity with the mark of its group, a scale with its own. */
export interface LinkActivity {
  id: number;
  describesMood: boolean;
}
export type LinkScale = ScaleFacts & { describesMood: boolean };

export interface LinksInput {
  /** Every diary day, oldest first. */
  allDays: readonly InsightDay[];
  /** Archived ones too, in display order. */
  activities: readonly LinkActivity[];
  scales: readonly LinkScale[];
  /** Rows from Health Connect; those of days without an entry are not used. */
  health: readonly HealthDay[];
  today: DateString;
}

/** The days the links are worked out over: those with an entry among the last `LINK_WINDOW_DAYS` up to today. */
export function linkDays(allDays: readonly InsightDay[], today: DateString): InsightDay[] {
  const from = addDaysToDateString(today, 1 - LINK_WINDOW_DAYS);
  return allDays.filter((day) => day.date >= from && day.date <= today);
}

/**
 * Everything the result depends on: the day, each day's mood, activities and scale values, sleep
 * and steps of the days with an entry, the scales and the marks.
 */
export function linksSignature({ allDays, activities, scales, health, today }: LinksInput): string {
  const days = linkDays(allDays, today);
  const dates = new Set<string>(days.map((day) => day.date));
  const dayPart = days
    .map((day) => `${day.date}:${day.mean}:${[...day.activities].sort((a, b) => a - b).join(',')}:${[...day.scales].map(([id, v]) => `${id}=${v.sum}/${v.count}`).join(',')}`)
    .join('|');
  // Today's steps still grow with every sync and are left out of the test, so they stay out here.
  const bodyPart = health
    .filter((row) => dates.has(row.date))
    .map((row) => `${row.date}:${row.sleep_minutes}:${row.date >= today ? '' : row.steps}`)
    .join('|');
  const marks = `${activities.map((activity) => `${activity.id}${activity.describesMood ? '!' : ''}`).join(',')}#${scales
    .map((scale) => `${scale.id}:${scale.kind}${scale.describesMood ? '!' : ''}`)
    .join(',')}`;
  return `${today}#${marks}#${bodyPart}#${dayPart}`;
}

/** A factor as one string, for sets and React keys. */
export const linkFactorKey = (factor: LinkFactor) => (factor.kind === 'health' ? `health:${factor.metric}` : `${factor.kind}:${factor.id}`);

/**
 * The diary as rows and factor columns, plus the keys of the marked factors. Activities first,
 * then scales, then sleep and steps.
 */
export function linkRows(input: LinksInput): { rows: LinkRows<LinkFactor>; marked: ReadonlySet<string> } {
  const { activities, scales, health, today } = input;
  const days = linkDays(input.allDays, today);
  const body = new Map(health.map((row) => [row.date, row]));
  const marked = new Set<string>();
  const factors: LinkColumn<LinkFactor>[] = [];
  for (const activity of activities) {
    const factor: LinkFactor = { kind: 'activity', id: activity.id };
    if (activity.describesMood) marked.add(linkFactorKey(factor));
    factors.push({ key: factor, kind: 'flag', values: days.map((day) => (day.activities.has(activity.id) ? 1 : 0)) });
  }
  for (const scale of scales) {
    const factor: LinkFactor = { kind: 'scale', id: scale.id };
    if (scale.describesMood) marked.add(linkFactorKey(factor));
    factors.push({
      key: factor,
      kind: 'value',
      values: days.map((day) => {
        const value = scaleDayValue(day, scale);
        // A duration of nothing is no value: zero minutes are mostly entries that left the scale alone.
        return scale.kind === 'duration' && value === 0 ? null : value;
      }),
    });
  }
  // Today's steps are not final yet and stay out, as on the health cards.
  for (const metric of ['sleep', 'steps'] as const) {
    factors.push({ key: { kind: 'health', metric }, kind: 'value', values: days.map((day) => settledValue(body.get(day.date), metric, today)) });
  }
  const first = days[0]?.date;
  return { rows: { dayNumbers: days.map((day) => daysBetween(first!, day.date)), mood: days.map((day) => day.mean), factors }, marked };
}

/**
 * The links of the diary, in slices like `linkSteps`. Without a marked factor one run over all
 * factors. With marks two: the lists come from a run over the unmarked factors only, so a tag
 * that describes the mood cannot explain another factor away; the marked ones get their own
 * result from a second run over everything.
 */
export function* linksSteps(input: LinksInput): Generator<void, Links, void> {
  const { rows, marked } = linkRows(input);
  const days = rows.mood.length;
  const found = (tests: LinkTest<LinkFactor>[], wanted: (key: string) => boolean): LinkFinding[] =>
    tests
      .filter((test): test is LinkTest<LinkFactor> & { level: LinkLevel } => test.level !== null && wanted(linkFactorKey(test.key)))
      .sort((a, b) => Number(b.level === 'stable') - Number(a.level === 'stable') || a.q - b.q)
      .map((test) => ({ factor: test.key, lag: test.lag, direction: test.direction, level: test.level, days: test.count }));

  const plain = yield* linkSteps({ ...rows, factors: rows.factors.filter((factor) => !marked.has(linkFactorKey(factor.key))) });
  const findings = found(plain, () => true);
  if (marked.size === 0) return { days, findings, describing: [] };
  const all = yield* linkSteps(rows);
  return { days, findings, describing: found(all, (key) => marked.has(key)) };
}

/** `linksSteps` in one go. */
export function buildLinks(input: LinksInput): Links {
  return drain(linksSteps(input));
}
