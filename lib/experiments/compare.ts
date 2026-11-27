import type { HealthDay } from '@/db/schema';
import { addDaysToDateString, daysBetween, type DateString } from '@/lib/dates';
import { daysIn, mean, moodDistribution, windowLength, type DayWindow, type InsightDay, type LevelShare } from '@/lib/insights';
import { settledValue, type HealthMetric } from '@/lib/insights/healthStats';
import { scaleDayValue, type ScaleFacts } from '@/lib/insights/scales';
import {
  activityShifts,
  differentSeasons,
  healthShifts,
  MIN_HEALTH_DAYS,
  MIN_SIDE_DAYS,
  type ActivityShift,
  type HealthShift,
} from '@/lib/turning/compare';

import { noiseCheck, type NoiseVerdict } from './noise';
import { experimentLength, experimentState, overlaps, type ExperimentSpan, type ExperimentState } from './rules';

/**
 * The days before an experiment next to the days in it. "Davor" is as long as the experiment
 * actually ran (`end_date - start_date + 1`), right before the start and shortened to what the
 * diary gives; "Im Experiment" runs from the start to the end or today. Shares the arithmetic with
 * the turning points: there `after`/`afterShare`/`afterDays` mean "im Experiment" here.
 *
 * Whether a difference goes beyond the usual ups and downs (`noise.ts`) is only judged once the
 * experiment is over; while it runs there are numbers and the course, no verdict. Like every
 * insight it describes the diary and says nothing about cause and effect.
 */

/** The hint about the seasons only from this length on, or it would fire at every turn of a month. */
export const SEASON_MIN_DAYS = 42;
/** "Davor" this far below the mean of all days before it hints at a return to the usual. */
export const REGRESSION_GAP = 0.3;
/** ... once there are this many days with entries before "Davor". */
export const REGRESSION_MIN_DAYS = 30;

export interface ExperimentFacts extends ExperimentSpan {
  id: number;
  title: string;
}

export interface ValueComparison {
  before: number;
  during: number;
  /** Only once the experiment is over; null while it runs or when the value was not judged. */
  verdict: NoiseVerdict | null;
}

export interface ScaleShift extends ValueComparison {
  scaleId: number;
  beforeDays: number;
  duringDays: number;
}

export interface HealthComparison extends HealthShift {
  verdict: NoiseVerdict | null;
}

export interface CheckInCounts {
  /** Days with an answer, and how many of them said "kept". */
  answered: number;
  kept: number;
  /** The day a "no" ended the experiment, or null. */
  endedByNo: DateString | null;
}

export interface ExperimentComparison {
  state: ExperimentState;
  /** Days from start to end, both included. */
  total: number;
  /** Days of the experiment up to today; `total` once it is over, 0 while it is planned. */
  elapsed: number;
  /** Ended before reaching `MIN_SIDE_DAYS` days: there is no comparison, ever. */
  tooShort: boolean;
  before: DayWindow | null;
  during: DayWindow | null;
  beforeDays: number;
  duringDays: number;
  /** Both sides have at least `MIN_SIDE_DAYS` days with entries. */
  enough: boolean;
  mood: ValueComparison | null;
  distribution: { before: LevelShare[]; during: LevelShare[] };
  scales: ScaleShift[];
  health: HealthComparison[];
  /** `after` there means "im Experiment" here. */
  activities: ActivityShift[];
  /** Number of values with a verdict (not "unjudgeable"); above one the page says more values make a chance hit likelier. */
  judged: number;
  seasons: boolean;
  /** "Davor" lay clearly below the usual, so part of a rise may be the return to it. */
  regression: boolean;
  /** Other experiments that shared days with this one, and those that ran in "Davor". */
  overlapDuring: ExperimentFacts[];
  overlapBefore: ExperimentFacts[];
}

export interface ExperimentInput {
  experiment: ExperimentFacts;
  /** Every experiment; the experiment itself is skipped. */
  experiments: readonly ExperimentFacts[];
  /** Every day of the diary, oldest first. */
  days: readonly InsightDay[];
  health: readonly HealthDay[];
  /** Active scales in display order. */
  scales: readonly ScaleFacts[];
  today: DateString;
}

export function compareExperiment({ experiment, experiments, days, health, scales, today }: ExperimentInput): ExperimentComparison {
  const start = experiment.start_date as DateString;
  const end = experiment.end_date as DateString;
  const state = experimentState(experiment, today);
  const total = experimentLength(experiment);
  const elapsed = state === 'planned' ? 0 : daysBetween(start, end < today ? end : today) + 1;
  const tooShort = state === 'over' && total < MIN_SIDE_DAYS;

  const first = days[0]?.date;
  const beforeFrom = addDaysToDateString(start, -total);
  const before = first !== undefined && first < start ? { from: first > beforeFrom ? first : beforeFrom, to: addDaysToDateString(start, -1) } : null;
  const during = elapsed > 0 ? { from: start, to: addDaysToDateString(start, elapsed - 1) } : null;
  const beforeList = before ? daysIn(days, before) : [];
  const duringList = during ? daysIn(days, during) : [];
  const enough = beforeList.length >= MIN_SIDE_DAYS && duringList.length >= MIN_SIDE_DAYS;
  const judge = enough && state === 'over';
  const lb = before ? windowLength(before) : 0;

  const verdictOf = (series: Map<string, number>, minDays: number): NoiseVerdict | null =>
    judge ? (noiseCheck({ series, start, beforeLength: lb, duringLength: elapsed, minDays })?.verdict ?? null) : null;

  const beforeMean = mean(beforeList.map((day) => day.mean));
  const duringMean = mean(duringList.map((day) => day.mean));
  const mood =
    enough && beforeMean !== null && duringMean !== null
      ? { before: beforeMean, during: duringMean, verdict: verdictOf(new Map(days.map((day) => [day.date, day.mean])), MIN_SIDE_DAYS) }
      : null;

  const scaleShifts = enough ? compareScaleValues(days, scales, beforeList, duringList, verdictOf) : [];
  const healthRows = enough && before && during ? healthShifts(health, before, during, today) : [];
  const healthComparisons = healthRows.map((row) => ({ ...row, verdict: verdictOf(healthSeries(health, row.metric, today), MIN_HEALTH_DAYS) }));

  const verdicts = [mood?.verdict, ...scaleShifts.map((row) => row.verdict), ...healthComparisons.map((row) => row.verdict)];
  const others = experiments.filter((other) => other.id !== experiment.id);

  return {
    state,
    total,
    elapsed,
    tooShort,
    before,
    during,
    beforeDays: beforeList.length,
    duringDays: duringList.length,
    enough,
    mood,
    distribution: { before: moodDistribution(beforeList, null), during: moodDistribution(duringList, null) },
    scales: scaleShifts,
    health: healthComparisons,
    activities: enough ? activityShifts(beforeList, duringList) : [],
    judged: verdicts.filter((verdict) => verdict && verdict.kind !== 'unjudgeable').length,
    seasons: total >= SEASON_MIN_DAYS && !!before && !!during && differentSeasons(before, during),
    regression: enough && before !== null && beforeMean !== null && regressionHint(days, before, beforeMean),
    overlapDuring: others.filter((other) => overlaps(other, experiment)),
    overlapBefore: before ? others.filter((other) => overlaps(other, { start_date: before.from, end_date: before.to })) : [],
  };
}

/** Each scale with at least `MIN_SIDE_DAYS` values on both sides. */
function compareScaleValues(
  days: readonly InsightDay[],
  scales: readonly ScaleFacts[],
  before: readonly InsightDay[],
  during: readonly InsightDay[],
  verdictOf: (series: Map<string, number>, minDays: number) => NoiseVerdict | null,
): ScaleShift[] {
  const values = (list: readonly InsightDay[], scale: ScaleFacts) =>
    list.flatMap((day) => {
      const value = scaleDayValue(day, scale);
      return value === null ? [] : [value];
    });
  return scales.flatMap((scale) => {
    const b = values(before, scale);
    const d = values(during, scale);
    if (b.length < MIN_SIDE_DAYS || d.length < MIN_SIDE_DAYS) return [];
    const series = new Map<string, number>();
    for (const day of days) {
      const value = scaleDayValue(day, scale);
      if (value !== null) series.set(day.date, value);
    }
    return [{ scaleId: scale.id, before: mean(b)!, during: mean(d)!, beforeDays: b.length, duringDays: d.length, verdict: verdictOf(series, MIN_SIDE_DAYS) }];
  });
}

/** Settled values only, so an unfinished today is missing rather than counted short. */
function healthSeries(rows: readonly HealthDay[], metric: HealthMetric, today: DateString): Map<string, number> {
  const series = new Map<string, number>();
  for (const row of rows) {
    const value = settledValue(row, metric, today);
    if (value !== null) series.set(row.date, value);
  }
  return series;
}

function regressionHint(days: readonly InsightDay[], before: DayWindow, beforeMean: number): boolean {
  const earlier = days.filter((day) => day.date < before.from);
  if (earlier.length < REGRESSION_MIN_DAYS) return false;
  return beforeMean <= mean(earlier.map((day) => day.mean))! - REGRESSION_GAP;
}

/**
 * "Eingehalten an X von Y Tagen mit Antwort", and whether a "no" ended it: that "no" sits on the
 * day after the end, or on the start day when the experiment ended there.
 */
export function checkInCounts(experiment: ExperimentSpan, answers: readonly { date: string; kept: boolean }[]): CheckInCounts {
  const endedByNo = answers.find((answer) => !answer.kept && (answer.date > experiment.end_date || (answer.date === experiment.start_date && experiment.end_date === experiment.start_date)));
  return {
    answered: answers.length,
    kept: answers.filter((answer) => answer.kept).length,
    endedByNo: (endedByNo?.date as DateString | undefined) ?? null,
  };
}
