import { getDb } from '@/db';
import { experimentAnswersOn, listExperimentDays, listExperiments } from '@/db/repositories/experiments';
import { listHealthDays } from '@/db/repositories/health';
import type { Experiment } from '@/db/schema';
import { readCatalogFromDb } from '@/lib/catalog/useCatalog';
import type { DateString } from '@/lib/dates';
import { readInsightDays } from '@/lib/insights/useInsights';
import { cached, useQuery } from '@/lib/store/dataVersion';

import { checkInCounts, compareExperiment, type CheckInCounts, type ExperimentComparison } from './compare';

/** Every experiment, oldest start first, read once per data version. */
export function readExperiments(): Experiment[] {
  return cached('experiments', () => listExperiments(getDb()));
}

export function useExperiments(): Experiment[] {
  return useQuery(readExperiments, []);
}

export function useExperiment(id: number): Experiment | undefined {
  return useQuery(() => readExperiments().find((experiment) => experiment.id === id), [id]);
}

/** The answers already stored for a day, by experiment id, for the entry editor. */
export function useExperimentAnswers(date: DateString): Map<number, boolean> {
  return useQuery(() => experimentAnswersOn(getDb(), date), [date]);
}

export interface ExperimentResult {
  comparison: ExperimentComparison;
  checkIn: CheckInCounts;
}

/** Computed only on the comparison page, never for the list, "Einblicke" or "Heute". */
export function useExperimentComparison(id: number, today: DateString): ExperimentResult | null {
  return useQuery(() => {
    const experiments = readExperiments();
    const experiment = experiments.find((row) => row.id === id);
    if (!experiment) return null;
    const health = cached('healthDays', () => listHealthDays(getDb()));
    const scales = cached('catalog', readCatalogFromDb).scales;
    return {
      comparison: compareExperiment({ experiment, experiments, days: readInsightDays(), health, scales, today }),
      checkIn: checkInCounts(experiment, listExperimentDays(getDb(), id)),
    };
  }, [id, today]);
}
