import { and, asc, count, eq, gt, lt, ne, or } from 'drizzle-orm';

import { today as todayDate, type DateString } from '@/lib/dates';
import {
  canAnswer,
  canEndEarly,
  cleanTitle,
  earlyEndDate,
  endDateAfterNo,
  endFromStart,
  isDuplicate,
  newDatesProblem,
  newExperimentProblem,
} from '@/lib/experiments/rules';

import { experimentDays, experiments, type Experiment, type ExperimentDay } from '../schema';
import { RepositoryError, type Database } from '../types';
import { assertDate, now, optionalText } from '../validate';

/** Oldest start first. */
export function listExperiments(db: Database): Experiment[] {
  return db.select().from(experiments).orderBy(asc(experiments.start_date), asc(experiments.id)).all();
}

export function getExperiment(db: Database, id: number): Experiment | undefined {
  return db.select().from(experiments).where(eq(experiments.id, id)).get();
}

export function countExperiments(db: Database): number {
  return db.select({ n: count() }).from(experiments).get()?.n ?? 0;
}

function found(db: Database, id: number): Experiment {
  const experiment = getExperiment(db, id);
  if (!experiment) throw new RepositoryError(`experiment ${id} not found`);
  return experiment;
}

export interface NewExperiment {
  title: string;
  note?: string | null;
  start_date: string;
  /** Length in days, 7 to 84. */
  days: number;
  check_in?: boolean;
}

/** One that is already over when it is created never brings the card on "Heute". */
export function createExperiment(db: Database, input: NewExperiment, today: DateString = todayDate()): Experiment {
  const start = assertDate(input.start_date, 'start_date');
  const problem = newExperimentProblem({ title: input.title, start, days: input.days }, today);
  if (problem) throw new RepositoryError(`experiment: ${problem}`);
  if (isDuplicate(listExperiments(db), { title: input.title, start_date: start })) throw new RepositoryError('experiment: duplicate');
  const end_date = endFromStart(start, input.days);
  return db
    .insert(experiments)
    .values({
      title: cleanTitle(input.title)!,
      note: optionalText(input.note?.trim()),
      start_date: start,
      end_date,
      check_in: input.check_in ?? false,
      result_seen: end_date < today,
    })
    .returning()
    .get();
}

export interface ExperimentPatch {
  title?: string;
  note?: string | null;
  check_in?: boolean;
  /** Start and length go together, and only while it is planned or running. */
  dates?: { start_date: string; days: number };
}

/** Answers outside a new span are removed with the save. */
export function updateExperiment(db: Database, id: number, patch: ExperimentPatch, today: DateString = todayDate()): Experiment {
  return db.transaction((tx) => {
    const experiment = found(tx, id);
    const clean: Partial<Experiment> = { updated_at: now() };
    if (patch.title !== undefined) {
      const title = cleanTitle(patch.title);
      if (title === null) throw new RepositoryError('experiment: title');
      clean.title = title;
    }
    if (patch.note !== undefined) clean.note = optionalText(patch.note?.trim());
    if (patch.check_in !== undefined) clean.check_in = patch.check_in;
    if (patch.dates) {
      const start = assertDate(patch.dates.start_date, 'start_date');
      const problem = newDatesProblem(experiment, { start, days: patch.dates.days }, today);
      if (problem) throw new RepositoryError(`experiment: ${problem}`);
      clean.start_date = start;
      clean.end_date = endFromStart(start, patch.dates.days);
    }
    if (isDuplicate(listExperiments(tx), { title: clean.title ?? experiment.title, start_date: clean.start_date ?? experiment.start_date }, id)) {
      throw new RepositoryError('experiment: duplicate');
    }
    const updated = tx.update(experiments).set(clean).where(eq(experiments.id, id)).returning().get()!;
    if (patch.dates) {
      tx.delete(experimentDays)
        .where(and(eq(experimentDays.experiment_id, id), or(lt(experimentDays.date, updated.start_date), gt(experimentDays.date, updated.end_date))))
        .run();
    }
    return updated;
  });
}

/** "Jetzt beenden": only while it runs. Ends yesterday (on the start day the start day) and drops later answers. */
export function endExperiment(db: Database, id: number, today: DateString = todayDate()): Experiment {
  return db.transaction((tx) => {
    const experiment = found(tx, id);
    if (!canEndEarly(experiment, today)) throw new RepositoryError(`experiment ${id} is not running`);
    const end_date = earlyEndDate(experiment, today);
    tx.delete(experimentDays).where(and(eq(experimentDays.experiment_id, id), gt(experimentDays.date, end_date))).run();
    return tx.update(experiments).set({ end_date, updated_at: now() }).where(eq(experiments.id, id)).returning().get()!;
  });
}

/** Its answers go with it. */
export function deleteExperiment(db: Database, id: number): void {
  db.delete(experiments).where(eq(experiments.id, id)).run();
}

/** The comparison was seen, or the card on "Heute" put away. Writes only when it changes something. */
export function markExperimentSeen(db: Database, id: number): void {
  db.update(experiments).set({ result_seen: true }).where(and(eq(experiments.id, id), eq(experiments.result_seen, false))).run();
}

export function listExperimentDays(db: Database, experimentId?: number): ExperimentDay[] {
  const query = db.select().from(experimentDays);
  const rows = experimentId === undefined ? query.all() : query.where(eq(experimentDays.experiment_id, experimentId)).all();
  return rows.sort((a, b) => a.experiment_id - b.experiment_id || a.date.localeCompare(b.date));
}

/** The answers given for one day, by experiment id. */
export function experimentAnswersOn(db: Database, date: string): Map<number, boolean> {
  return new Map(
    db
      .select()
      .from(experimentDays)
      .where(eq(experimentDays.date, date))
      .all()
      .map((row) => [row.experiment_id, row.kept]),
  );
}

/**
 * Saves the answers of the entry editor for one day: true kept, false not kept, null takes the
 * answer back. A "no" ends the experiment (the editor asked before): it ends the day before, on the
 * start day the start day itself, the "no" stays and every later answer goes.
 */
export function setExperimentDays(db: Database, date: string, answers: Readonly<Record<number, boolean | null>>, today: DateString = todayDate()): void {
  const day = assertDate(date);
  db.transaction((tx) => {
    for (const [key, kept] of Object.entries(answers)) {
      const id = Number(key);
      const where = and(eq(experimentDays.experiment_id, id), eq(experimentDays.date, day));
      if (kept === null) {
        tx.delete(experimentDays).where(where).run();
        continue;
      }
      const experiment = found(tx, id);
      if (!canAnswer(experiment, day, today)) throw new RepositoryError(`experiment ${id}: no answer on ${day}`);
      tx.insert(experimentDays)
        .values({ experiment_id: id, date: day, kept })
        .onConflictDoUpdate({ target: [experimentDays.experiment_id, experimentDays.date], set: { kept } })
        .run();
      if (kept) continue;
      const end_date = endDateAfterNo(experiment, day);
      tx.delete(experimentDays)
        .where(and(eq(experimentDays.experiment_id, id), gt(experimentDays.date, end_date), ne(experimentDays.date, day)))
        .run();
      tx.update(experiments).set({ end_date, updated_at: now() }).where(eq(experiments.id, id)).run();
    }
  });
}
