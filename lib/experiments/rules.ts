import { addDaysToDateString, daysBetween, type DateString } from '@/lib/dates';
import { fold } from '@/lib/search/fold';

/**
 * Rules for experiments, pure: how long one may run, where it may start, when it may be edited or
 * ended. The state is never stored, it follows from the dates and today.
 */

/** The choices for the length, in weeks. */
export const EXPERIMENT_WEEKS = [1, 2, 3, 4, 6, 8, 12] as const;
export const DEFAULT_EXPERIMENT_WEEKS = 4;
export const MIN_EXPERIMENT_DAYS = 7;
export const MAX_EXPERIMENT_DAYS = 84;
/** A start in the past is wanted ("I have been taking it for ten days"), up to a year back. */
export const START_DAYS_BACK = 365;
export const START_DAYS_AHEAD = 60;
export const TITLE_MAX_LENGTH = 60;

export type ExperimentState = 'planned' | 'running' | 'over';

/** What the rules need from an experiment; the stored row fits as it is. */
export interface ExperimentSpan {
  start_date: string;
  end_date: string;
}

/** Last day, inclusive, of an experiment of `days` days from `start`. */
export function endFromStart(start: DateString, days: number): DateString {
  return addDaysToDateString(start, days - 1);
}

/** How many of the answers fall outside a new span; saving new dates removes them. */
export function answersOutside(answers: readonly { date: string }[], span: ExperimentSpan): number {
  return answers.filter((answer) => answer.date < span.start_date || answer.date > span.end_date).length;
}

/** Days from start to end, both included. */
export function experimentLength(experiment: ExperimentSpan): number {
  return daysBetween(experiment.start_date as DateString, experiment.end_date as DateString) + 1;
}

/**
 * Planned before the start, running up to the end, over after it. One exception: an experiment of a
 * single day can only come from a "no" on its start day (or the day after), because the shortest
 * choice is a week. It is over from that day on, so the "no" ends it at once.
 */
export function experimentState(experiment: ExperimentSpan, today: DateString): ExperimentState {
  if (today < experiment.start_date) return 'planned';
  if (today < experiment.end_date) return 'running';
  if (today === experiment.end_date && experiment.end_date !== experiment.start_date) return 'running';
  return 'over';
}

/** "Tag 9 von 28": the day of the experiment today is, 0 while planned, the length once over. */
export function experimentProgress(experiment: ExperimentSpan, today: DateString): { day: number; total: number } {
  const total = experimentLength(experiment);
  const day = Math.min(total, Math.max(0, daysBetween(experiment.start_date as DateString, today) + 1));
  return { day, total };
}

/** Earliest and latest start the form offers on `today`. */
export function startBounds(today: DateString): { min: DateString; max: DateString } {
  return { min: addDaysToDateString(today, -START_DAYS_BACK), max: addDaysToDateString(today, START_DAYS_AHEAD) };
}

/** The title as it is stored, or null when it is empty or too long. */
export function cleanTitle(title: string): string | null {
  const clean = title.trim();
  return clean.length >= 1 && clean.length <= TITLE_MAX_LENGTH ? clean : null;
}

export type ExperimentProblem = 'title' | 'length' | 'startTooEarly' | 'startTooLate' | 'endBeforeToday' | 'over' | 'duplicate';

/** What is wrong with a new experiment, or null. */
export function newExperimentProblem(input: { title: string; start: DateString; days: number }, today: DateString): ExperimentProblem | null {
  if (cleanTitle(input.title) === null) return 'title';
  if (!Number.isInteger(input.days) || input.days < MIN_EXPERIMENT_DAYS || input.days > MAX_EXPERIMENT_DAYS) return 'length';
  const bounds = startBounds(today);
  if (input.start < bounds.min) return 'startTooEarly';
  if (input.start > bounds.max) return 'startTooLate';
  return null;
}

/**
 * What is wrong with new dates for a stored experiment, or null. Start and length change only while
 * it is planned or running, and the new end may not lie before today: ending early goes through
 * "Jetzt beenden".
 */
export function newDatesProblem(experiment: ExperimentSpan, input: { start: DateString; days: number }, today: DateString): ExperimentProblem | null {
  if (experimentState(experiment, today) === 'over') return 'over';
  const problem = newExperimentProblem({ title: 'x', start: input.start, days: input.days }, today);
  if (problem) return problem;
  if (endFromStart(input.start, input.days) < today) return 'endBeforeToday';
  return null;
}

/**
 * Only a running experiment ends early, and not on its start day: it would end on that day with
 * nothing to compare. A planned one, or one on its start day, is deleted instead.
 */
export function canEndEarly(experiment: ExperimentSpan, today: DateString): boolean {
  return experimentState(experiment, today) === 'running' && today > experiment.start_date;
}

/**
 * The new last day when it ends early on `date`: the day before, never before the start day. Used
 * for "Jetzt beenden" (with today) and for a "no" on `date`; that "no" itself is kept, so the
 * comparison can say how it ended.
 */
export function endOnDayBefore(experiment: ExperimentSpan, date: DateString): DateString {
  const before = addDaysToDateString(date, -1);
  return before < experiment.start_date ? (experiment.start_date as DateString) : before;
}

/** Two experiments overlap when their spans share at least one day. */
export function overlaps(a: ExperimentSpan, b: ExperimentSpan): boolean {
  return a.start_date <= b.end_date && b.start_date <= a.end_date;
}

/**
 * "Kept today?" can be answered for days on which the experiment runs and not after today, and only
 * while it is not over today (E17): once over, the result stays, so an old entry neither asks nor
 * shortens it afterwards with a "no". An experiment a "no" ended on its start day asks no more,
 * not even on that day.
 */
export function canAnswer(experiment: ExperimentSpan, date: DateString, today: DateString): boolean {
  return date <= today && experimentState(experiment, date) === 'running' && experimentState(experiment, today) !== 'over';
}

/** The experiments that ask "kept today?" in the editor for `date`. */
export function askingOn<T extends ExperimentSpan & { check_in: boolean }>(experiments: readonly T[], date: DateString, today: DateString): T[] {
  return experiments.filter((experiment) => experiment.check_in && canAnswer(experiment, date, today));
}

/** Same folded title and exactly the same start: the same experiment, for merging and the import preview. */
export function experimentKey(experiment: { title: string; start_date: string }): string {
  return `${fold(experiment.title.trim())}|${experiment.start_date}`;
}

/**
 * Another experiment than `exceptId` already has the same key. Two of them would melt into one when a
 * backup is merged, so the app keeps them apart from the start.
 */
export function isDuplicate(
  experiments: readonly { id: number; title: string; start_date: string }[],
  candidate: { title: string; start_date: string },
  exceptId?: number,
): boolean {
  const key = experimentKey(candidate);
  return experiments.some((other) => other.id !== exceptId && experimentKey(other) === key);
}
