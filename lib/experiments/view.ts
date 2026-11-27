import type { TFunction } from 'i18next';

import type { DateString } from '@/lib/dates';
import { formatPercent } from '@/lib/insights/format';

import type { NoiseVerdict } from './noise';
import { EXPERIMENT_WEEKS, experimentState, type ExperimentSpan } from './rules';

/**
 * What the screens show of experiments, pure: the sections of the list, the length choices of the
 * form and the verdict in words. Never a word about cause or effect, only the own entries.
 */

export interface ExperimentSections<T> {
  running: T[];
  planned: T[];
  over: T[];
}

/** Running and planned by start, the ones that are over with the latest end first. */
export function experimentSections<T extends ExperimentSpan>(experiments: readonly T[], today: DateString): ExperimentSections<T> {
  const sections: ExperimentSections<T> = { running: [], planned: [], over: [] };
  for (const experiment of experiments) sections[experimentState(experiment, today)].push(experiment);
  const byStart = (a: T, b: T) => a.start_date.localeCompare(b.start_date);
  sections.running.sort(byStart);
  sections.planned.sort(byStart);
  sections.over.sort((a, b) => b.end_date.localeCompare(a.end_date));
  return sections;
}

/** The lengths the form offers in days: the weeks, plus a stored length that is no whole choice. */
export function lengthChoices(current: number | null): number[] {
  const days: number[] = EXPERIMENT_WEEKS.map((weeks) => weeks * 7);
  if (current !== null && !days.includes(current)) days.push(current);
  return days.sort((a, b) => a - b);
}

/** The verdict as full sentences for the mood: the verdict, and "vorläufig" when it is. */
export function verdictSentences(t: TFunction, verdict: NoiseVerdict | null): string[] {
  if (!verdict) return [];
  if (verdict.kind === 'unjudgeable') return [t('experiments.noise.unjudgeable')];
  const sentence = t(`experiments.noise.${verdict.kind}`, { share: formatPercent(verdict.share) });
  return verdict.preliminary ? [sentence, t('experiments.noise.preliminary')] : [sentence];
}

/** The verdict in a few words for a row: "im Rahmen, 34 %", "größer als üblich, 6 %, vorläufig". */
export function verdictShort(t: TFunction, verdict: NoiseVerdict | null): string | null {
  if (!verdict) return null;
  if (verdict.kind === 'unjudgeable') return t('experiments.short.unjudgeable');
  const text = t(`experiments.short.${verdict.kind}`, { share: formatPercent(verdict.share) });
  return verdict.preliminary ? t('experiments.short.preliminary', { verdict: text }) : text;
}
