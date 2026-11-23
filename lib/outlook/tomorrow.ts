import { addDaysToDateString, daysBetween, weekdayOf, type DateString } from '@/lib/dates';
import { byDate, scaleDayValue, type InsightDay, type ScaleFacts } from '@/lib/insights';

/**
 * "Morgen stehen die Zeichen gut": a hint on "Heute", after today's entry, when the next day has a
 * better chance than usual to be a good one. Good is personal: a level that reaches at least the
 * user's own mean mood, and never below the middle of the scale, so someone whose days are mostly 2
 * or 3 is not measured against someone whose days are mostly 4.
 *
 * The chance comes from a small logistic regression over every pair of consecutive diary days,
 * on what anyone's diary has: the day's mood and the day before's, every activity, every scale
 * (with whether it was filled in), last night's sleep and the steps of the day before when Health
 * Connect has them, and the weekday of the next day. A strong ridge penalty keeps a handful of days
 * from swinging it.
 *
 * Whether it shows is a matter of rank, not of a fixed bar: today has to be among the days with
 * the best chances of the last 90, and above the usual share. After quiet days the rank it needs
 * steps down, so the hint comes about one to four times in two weeks for every diary, whatever its
 * share of good days. It never speaks of a worse day. A backtest only decides whether the card may
 * name a hit rate, and it names the one of the very step that showed the hint: a number fitted and
 * measured on the same days would read close to 100 % even on a diary of pure chance.
 */

/** A good day reaches at least the user's mean, and at least this level. */
export const MIN_GOOD_LEVEL = 3;
/** Pairs of consecutive days needed before the first hint. */
export const MIN_PAIRS = 30;
/** The days whose chances today's is ranked against. */
export const REFERENCE_DAYS = 90;
/** At most `MAX_IN_WINDOW` hints, and at least one, within `WINDOW_DAYS`. */
export const WINDOW_DAYS = 14;
export const MAX_IN_WINDOW = 4;
/**
 * The steps of the rank rule. Normally today has to reach the `top` quantile of those chances.
 * After `FLOOR_AFTER` days without a hint the `floor` quantile is enough, and after
 * `ABOVE_AFTER` any chance above the usual share, so two weeks rarely pass without one. A day below
 * the usual share never gets the hint.
 */
export const TOP_QUANTILE = 0.86;
export const FLOOR_QUANTILE = 0.6;
export const FLOOR_AFTER = 9;
export const ABOVE_AFTER = 11;
/** Above this usual share nothing is better than usual: the hint cannot come. */
export const ALWAYS_GOOD = 0.98;
/** The backtest refits every this many pairs; in between the model stays as it was. */
export const REFIT_EVERY = 7;
/** Backtest days at the hint's step needed before the card names how often it came true, and by how much it has to beat usual. */
export const MIN_PROOF_CASES = 8;
export const MIN_PROOF_LIFT = 0.03;
/** Ridge penalty and gradient steps of the fit; it yields every `STEPS_PER_YIELD`. */
export const RIDGE = 0.2;
const STEPS = 400;
const WARM_STEPS = 80;
const STEPS_PER_YIELD = 5;
/** Rows encoded between two yields. */
const ROWS_PER_YIELD = 150;
/** Contributions (log-odds) from which a reason is named; higher while there is no proof yet. */
export const REASON_MIN = 0.1;
export const REASON_MIN_UNPROVEN = 0.15;
export const MAX_REASONS = 2;
/** "Morgen ist Samstag" only counts as a reason once every weekday has been seen often enough. */
export const WEEKDAY_REASON_PAIRS = 90;

/** How high today ranks: `top` among the best, `floor` after quiet days, `above` only above usual. */
export type TomorrowTier = 'top' | 'floor' | 'above';
const TIERS: readonly TomorrowTier[] = ['top', 'floor', 'above'];

/** Sleep and steps of a day from Health Connect; sleep is the night that ended on that day. */
export interface BodyDay {
  sleep: number | null;
  steps: number | null;
}
export type BodyByDate = ReadonlyMap<string, BodyDay>;

type Features = Map<string, number>;

interface Pair {
  day: InsightDay;
  previous: InsightDay | undefined;
  next: DateString;
  /** Level of the next day; whether it was good depends on the line of the moment. */
  nextLevel: number;
}

/**
 * What one day says about the next. Mood, the day before's mood, activities, scales, last night's
 * sleep, the day before's steps, and the next day's weekday. A scale left empty gets no value but
 * its own marker, so an empty rating does not read as its middle and an empty duration not as zero
 * minutes. Steps are the day before's because today's still grow while the entry is made.
 */
function features(pair: Pick<Pair, 'day' | 'previous' | 'next'>, scales: readonly ScaleFacts[], body: BodyByDate): Features {
  const { day, previous, next } = pair;
  const f: Features = new Map([
    ['bias', 1],
    ['mood', day.mean - 3],
  ]);
  if (previous) f.set('previous', previous.mean - 3);
  for (const id of day.activities) f.set(`a${id}`, 1);
  for (const scale of scales) {
    const value = scaleDayValue(day, scale);
    if (value === null) continue;
    f.set(`p${scale.id}`, 1);
    // Ratings around their middle, durations in working days, so every weight speaks about the same size.
    f.set(`s${scale.id}`, scale.kind === 'duration' ? Math.min(2, value / 480) : (value - (scale.min + scale.max) / 2) / Math.max(1, scale.max - scale.min));
  }
  // Hours from seven, thousands of steps from eight thousand, capped, so one marathon does not tip it.
  const sleep = body.get(day.date)?.sleep;
  if (sleep != null) f.set('sleep', Math.max(-3, Math.min(3, (sleep - 420) / 60)));
  const steps = body.get(addDaysToDateString(day.date, -1))?.steps;
  if (steps != null) f.set('steps', Math.max(-2, Math.min(3, (steps - 8000) / 4000)));
  f.set(`w${weekdayOf(next)}`, 1);
  return f;
}

/**
 * Features as positions in one weight array: the fit runs dozens of times over a year of days,
 * and on a phone string keys and maps would make that seconds instead of milliseconds.
 */
interface Row {
  index: Int32Array;
  value: Float64Array;
  nextLevel: number;
  /** Of this row's date, features and outcome; chained over rows, it names a prefix of the diary. */
  hash: number;
}

/** FNV-1a over a string, 32 bits. */
function hashOf(text: string, seed = 2166136261): number {
  let h = seed;
  for (let i = 0; i < text.length; i += 1) h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0;
  return h;
}

class Encoder {
  readonly keys: string[] = ['bias'];
  private readonly positions = new Map<string, number>([['bias', 0]]);

  row(f: Features, nextLevel: number, date = ''): Row {
    const index = new Int32Array(f.size);
    const value = new Float64Array(f.size);
    let i = 0;
    let text = `${date}>${nextLevel}`;
    for (const [key, v] of f) {
      let position = this.positions.get(key);
      if (position === undefined) {
        position = this.keys.length;
        this.keys.push(key);
        this.positions.set(key, position);
      }
      index[i] = position;
      value[i] = v;
      text += `|${key}=${v}`;
      i += 1;
    }
    return { index, value, nextLevel, hash: hashOf(text) };
  }

  position(key: string): number {
    return this.positions.get(key) ?? -1;
  }
}

function predict(weights: Float64Array, row: Row): number {
  let z = 0;
  for (let i = 0; i < row.index.length; i += 1) z += (weights[row.index[i]!] ?? 0) * row.value[i]!;
  return 1 / (1 + Math.exp(-z));
}

/**
 * Gradient descent on the penalised log loss; the bias (position 0) is not penalised. The step is
 * 1/L for the loss's smoothness bound L = max‖x‖²/4 + ridge, so someone who ticks thirty
 * activities every day gets a smaller step instead of a fit that swings off. Yields every few
 * steps, so even three years of diary never hold a phone's thread for long.
 */
function* fitSteps(rows: readonly Row[], level: number, size: number, start?: Float64Array): Generator<void, Float64Array> {
  const weights = new Float64Array(size);
  if (start) weights.set(start.subarray(0, Math.min(size, start.length)));
  const gradient = new Float64Array(size);
  let norm = 1;
  for (const row of rows) {
    let sum = 0;
    for (let i = 0; i < row.value.length; i += 1) sum += row.value[i]! ** 2;
    norm = Math.max(norm, sum);
  }
  const rate = 1 / (norm / 4 + RIDGE);
  const steps = start ? WARM_STEPS : STEPS;
  for (let step = 0; step < steps; step += 1) {
    gradient.fill(0);
    for (const row of rows) {
      const error = predict(weights, row) - (row.nextLevel >= level ? 1 : 0);
      for (let i = 0; i < row.index.length; i += 1) gradient[row.index[i]!]! += error * row.value[i]!;
    }
    for (let k = 0; k < size; k += 1) weights[k]! -= rate * (gradient[k]! / rows.length + (k === 0 ? 0 : RIDGE * weights[k]!));
    if ((step + 1) % STEPS_PER_YIELD === 0) yield;
  }
  return weights;
}

function pairsOf(days: readonly InsightDay[]): Pair[] {
  const lookup = byDate(days);
  return days.flatMap((day) => {
    const next = addDaysToDateString(day.date, 1);
    const after = lookup.get(next);
    return after ? [{ day, previous: lookup.get(addDaysToDateString(day.date, -1)), next, nextLevel: after.level }] : [];
  });
}

/**
 * The lowest level that counts as good: the first level that reaches the mean of the days given,
 * at least `MIN_GOOD_LEVEL`. Rounding down instead would make every day good for someone who only
 * ever logs 3 and 4 with a mean of 3.3.
 */
export function goodLevel(days: readonly Pick<InsightDay, 'mean'>[]): number {
  if (days.length === 0) return MIN_GOOD_LEVEL;
  return Math.max(MIN_GOOD_LEVEL, Math.ceil(days.reduce((sum, day) => sum + day.mean, 0) / days.length - 1e-9));
}

/** Linear interpolation between order statistics; null for no values. */
export function quantile(values: readonly number[], q: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * q;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return sorted[lower]! + (sorted[upper]! - sorted[lower]!) * (position - lower);
}

/** Index of the first of `pairs[0..end)` whose day lies less than `REFERENCE_DAYS` before `anchor`. */
function referenceStart(pairs: readonly Pair[], end: number, anchor: DateString): number {
  let start = end;
  while (start > 0 && daysBetween(pairs[start - 1]!.day.date, anchor) < REFERENCE_DAYS) start -= 1;
  return start;
}

/** The highest step a chance reaches against the bars of the moment, null below usual. */
function tierOf(chance: number, usual: number, top: number, floor: number): TomorrowTier | null {
  if (chance <= usual) return null;
  return chance >= top ? 'top' : chance >= floor ? 'floor' : 'above';
}

export interface TomorrowCase {
  chance: number;
  good: boolean;
  /** Share of good next days among the pairs the model was fitted on. */
  usual: number;
  /** The step of the rank rule this day would have reached then, null below usual. */
  tier: TomorrowTier | null;
}

interface Block {
  cases: TomorrowCase[];
  weights: Float64Array;
}

/**
 * Finished backtest blocks by the prefix of the diary they saw, so a new entry only refits the last
 * week: everything before it is the same diary up to that day, and the fits are deterministic.
 * Only the blocks of the last run are kept.
 */
let blockCache = new Map<string, Block>();

/** Tests: forget every cached block. */
export function resetTomorrowCache(): void {
  blockCache = new Map();
}

/**
 * Steps through the diary: fit on the pairs before, predict the next `REFIT_EVERY`, and note the
 * step each would have reached. A pair before index i ends on or before the day pair i starts on,
 * so nothing from the future leaks in. Each fit starts from the one before.
 */
function* backtestSteps(pairs: readonly Pair[], rows: readonly Row[], size: number): Generator<void, { cases: TomorrowCase[]; weights: Float64Array | undefined }> {
  const cases: TomorrowCase[] = [];
  const used = new Map<string, Block>();
  const prefix: number[] = [];
  let chain = 0;
  for (const row of rows) prefix.push((chain = hashOf(String(row.hash), chain || 2166136261)));
  let weights: Float64Array | undefined;
  for (let i = MIN_PAIRS; i < rows.length; i += REFIT_EVERY) {
    const end = Math.min(i + REFIT_EVERY, rows.length);
    // Not keyed on `size`: features that only appear later have weight 0 in every earlier fit.
    const key = `${i}:${end}:${prefix[end - 1]}`;
    let block = blockCache.get(key);
    if (!block) {
      const train = rows.slice(0, i);
      const level = goodLevel(pairs.slice(0, i).map((pair) => pair.day));
      const fitted = yield* fitSteps(train, level, size, weights);
      const usual = train.filter((row) => row.nextLevel >= level).length / train.length;
      const reference = rows.slice(referenceStart(pairs, i, pairs[i]!.day.date), i).map((row) => predict(fitted, row));
      const top = quantile(reference, TOP_QUANTILE) ?? 1;
      const floor = quantile(reference, FLOOR_QUANTILE) ?? 1;
      block = {
        weights: fitted,
        cases: rows.slice(i, end).map((row) => {
          const chance = predict(fitted, row);
          return { chance, good: row.nextLevel >= level, usual, tier: tierOf(chance, usual, top, floor) };
        }),
      };
      yield;
    }
    used.set(key, block);
    weights = block.weights;
    cases.push(...block.cases);
  }
  blockCache = used;
  return { cases, weights };
}

function finish<T>(steps: Generator<void, T>): T {
  for (;;) {
    const next = steps.next();
    if (next.done) return next.value;
  }
}

function* encodeSteps(pairs: readonly Pair[], scales: readonly ScaleFacts[], body: BodyByDate): Generator<void, { encoder: Encoder; rows: Row[] }> {
  const encoder = new Encoder();
  const rows: Row[] = [];
  for (const pair of pairs) {
    rows.push(encoder.row(features(pair, scales, body), pair.nextLevel, pair.day.date));
    if (rows.length % ROWS_PER_YIELD === 0) yield;
  }
  return { encoder, rows };
}

/** The backtest on its own, for tests and scripts. */
export function tomorrowBacktest(days: readonly InsightDay[], scales: readonly ScaleFacts[], body: BodyByDate = new Map()): TomorrowCase[] {
  const pairs = pairsOf(days);
  const { encoder, rows } = finish(encodeSteps(pairs, scales, body));
  return finish(backtestSteps(pairs, rows, encoder.keys.length)).cases;
}

/** How often the next day was good after the backtest days that reached a step. */
export interface TomorrowProof {
  hitRate: number;
  /** What those same days usually turned out like: the comparison for `hitRate`. */
  usual: number;
  cases: number;
}

/**
 * A hit rate the card may name for a step: the backtest days that reached at least that step,
 * enough of them, and clearly better than usual on them. Null otherwise.
 */
export function proofOf(cases: readonly TomorrowCase[], tier: TomorrowTier = 'top'): TomorrowProof | null {
  const reach = TIERS.indexOf(tier);
  const picked = cases.filter((c) => c.tier !== null && TIERS.indexOf(c.tier) <= reach);
  if (picked.length < MIN_PROOF_CASES) return null;
  const hitRate = picked.filter((c) => c.good).length / picked.length;
  const usual = picked.reduce((sum, c) => sum + c.usual, 0) / picked.length;
  return hitRate - usual >= MIN_PROOF_LIFT ? { hitRate, usual, cases: picked.length } : null;
}

export type TomorrowReason =
  | { kind: 'mood' }
  | { kind: 'sleep'; minutes: number }
  | { kind: 'steps'; steps: number }
  | { kind: 'activity'; activityId: number }
  | { kind: 'scale'; scaleId: number; value: number }
  | { kind: 'weekday'; weekday: number };

export interface GoodTomorrow {
  date: DateString;
  /** The lowest mood level that counts as good for this user, for the card's wording. */
  level: number;
  /** The step that showed it; `top` is the only one that may call today one of the best days. */
  tier: TomorrowTier;
  /** For that step. Null while the backtest cannot back a number yet: the card then says so instead. */
  proof: TomorrowProof | null;
  /** What pushed the chance up most, strongest first. */
  reasons: TomorrowReason[];
}

/** Why the hint shows or not, for the outlook page. `shown` counts the last `WINDOW_DAYS` including today. */
export type TomorrowStatus =
  | { kind: 'tooFew'; pairs: number; needed: number }
  | { kind: 'alwaysGood'; level: number }
  | { kind: 'ready'; level: number; proof: TomorrowProof | null; shown: number };

export interface TomorrowResult {
  status: TomorrowStatus;
  /** Null without an entry today, when today does not rank high enough, or after enough hints lately. */
  hint: GoodTomorrow | null;
}

export interface TomorrowInput {
  days: readonly InsightDay[];
  scales: readonly ScaleFacts[];
  today: DateString;
  /** Days on which the hint was shown; only the `WINDOW_DAYS` up to today count. */
  shown: readonly string[];
  body?: BodyByDate;
}

/** Backtest, rank and the hint for the day after `today`, a few fitting steps per step. */
export function* tomorrowSteps({ days, scales, today, shown, body = new Map() }: TomorrowInput): Generator<void, TomorrowResult> {
  const recorded = days.filter((day) => day.date <= today);
  const pairs = pairsOf(recorded);
  if (pairs.length < MIN_PAIRS) return { status: { kind: 'tooFew', pairs: pairs.length, needed: MIN_PAIRS }, hint: null };

  const { encoder, rows } = yield* encodeSteps(pairs, scales, body);
  const backtest = yield* backtestSteps(pairs, rows, encoder.keys.length);
  const level = goodLevel(recorded);
  const usual = rows.filter((row) => row.nextLevel >= level).length / rows.length;
  if (usual >= ALWAYS_GOOD) return { status: { kind: 'alwaysGood', level }, hint: null };

  const windowStart = addDaysToDateString(today, -WINDOW_DAYS);
  const inWindow = shown.filter((date) => date > windowStart && date <= today);
  const status: TomorrowStatus = { kind: 'ready', level, proof: proofOf(backtest.cases, 'top'), shown: inWindow.length };
  const earlier = inWindow.filter((date) => date < today);
  const last = recorded[recorded.length - 1];
  if (!last || last.date !== today || earlier.length >= MAX_IN_WINDOW) return { status, hint: null };

  // Days since the last hint; a diary without any counts from the first day a hint was possible.
  const lastShown = [...shown].filter((date) => date < today).sort().pop();
  const quiet = lastShown ? daysBetween(lastShown as DateString, today) : daysBetween(pairs[MIN_PAIRS - 1]!.day.date, today) + 1;
  const weights = yield* fitSteps(rows, level, encoder.keys.length, backtest.weights);
  yield;
  const next = addDaysToDateString(today, 1);
  const f = features({ day: last, previous: byDate(recorded).get(addDaysToDateString(today, -1)), next }, scales, body);
  const chance = predict(weights, encoder.row(f, 0));
  const reference = rows.slice(referenceStart(pairs, pairs.length, today)).map((row) => predict(weights, row));
  const tier = tierOf(chance, usual, quantile(reference, TOP_QUANTILE) ?? 1, quantile(reference, FLOOR_QUANTILE) ?? 1);
  const needed: TomorrowTier = quiet >= ABOVE_AFTER ? 'above' : quiet >= FLOOR_AFTER ? 'floor' : 'top';
  if (tier === null || TIERS.indexOf(tier) > TIERS.indexOf(needed)) return { status, hint: null };

  const proof = proofOf(backtest.cases, tier);
  const reasonMin = proof ? REASON_MIN : REASON_MIN_UNPROVEN;
  const reasons = [...f]
    .filter(([key, value]) => {
      // A low mood that tends to bounce back is no reason to name "your mood today", nor is a short
      // night or a lazy day; the day before, the marker for a filled-in scale and the bias are not
      // what a person would call a reason.
      if (key === 'mood') return last.mean > 3;
      if (key === 'sleep' || key === 'steps') return value > 0;
      if (key.startsWith('w')) return pairs.length >= WEEKDAY_REASON_PAIRS;
      return key.startsWith('a') || key.startsWith('s');
    })
    .map(([key, value]) => ({ key, push: (weights[encoder.position(key)] ?? 0) * value }))
    .filter((part) => part.push >= reasonMin)
    .sort((a, b) => b.push - a.push)
    .slice(0, MAX_REASONS)
    .map(({ key }): TomorrowReason => {
      if (key === 'mood') return { kind: 'mood' };
      if (key === 'sleep') return { kind: 'sleep', minutes: body.get(today)!.sleep! };
      if (key === 'steps') return { kind: 'steps', steps: body.get(addDaysToDateString(today, -1))!.steps! };
      const id = Number(key.slice(1));
      if (key.startsWith('a')) return { kind: 'activity', activityId: id };
      if (key.startsWith('s')) return { kind: 'scale', scaleId: id, value: scaleDayValue(last, scales.find((scale) => scale.id === id)!)! };
      return { kind: 'weekday', weekday: id };
    });
  return { status, hint: { date: next, level, tier, proof, reasons } };
}

/** The same in one go, for tests and scripts. */
export function goodTomorrow(input: TomorrowInput): TomorrowResult {
  return finish(tomorrowSteps(input));
}
