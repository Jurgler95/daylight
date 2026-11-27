import type { DateString } from '@/lib/dates';

import {
  askingOn,
  canAnswer,
  canEndEarly,
  cleanTitle,
  earlyEndDate,
  endDateAfterNo,
  endFromStart,
  experimentKey,
  experimentLength,
  experimentProgress,
  experimentState,
  newDatesProblem,
  newExperimentProblem,
  overlaps,
  startBounds,
} from '../rules';

const d = (value: string) => value as DateString;
const today = d('2026-11-27');
const span = { start_date: '2026-11-20', end_date: '2026-12-17' };

describe('experiment rules', () => {
  it('derives the state and progress from the dates', () => {
    expect(experimentState(span, d('2026-11-19'))).toBe('planned');
    expect(experimentState(span, d('2026-11-20'))).toBe('running');
    expect(experimentState(span, d('2026-12-17'))).toBe('running');
    expect(experimentState(span, d('2026-12-18'))).toBe('over');
    expect(experimentProgress(span, today)).toEqual({ day: 8, total: 28 });
    expect(experimentProgress(span, d('2026-11-01'))).toEqual({ day: 0, total: 28 });
    expect(experimentProgress(span, d('2027-03-01'))).toEqual({ day: 28, total: 28 });
    expect(experimentLength(span)).toBe(28);
    expect(endFromStart(d('2026-12-01'), 7)).toBe('2026-12-07');
  });

  it('checks title, length and start', () => {
    expect(cleanTitle('  Spaziergang ')).toBe('Spaziergang');
    expect(cleanTitle('')).toBeNull();
    expect(cleanTitle('x'.repeat(60))).toHaveLength(60);
    expect(cleanTitle('x'.repeat(61))).toBeNull();
    expect(startBounds(today)).toEqual({ min: '2025-11-27', max: '2027-01-26' });
    expect(newExperimentProblem({ title: 'A', start: d('2025-11-27'), days: 7 }, today)).toBeNull();
    expect(newExperimentProblem({ title: 'A', start: d('2027-01-26'), days: 84 }, today)).toBeNull();
    expect(newExperimentProblem({ title: 'A', start: d('2025-11-26'), days: 7 }, today)).toBe('startTooEarly');
    expect(newExperimentProblem({ title: 'A', start: d('2027-01-27'), days: 7 }, today)).toBe('startTooLate');
    expect(newExperimentProblem({ title: 'A', start: today, days: 7.5 }, today)).toBe('length');
    expect(newExperimentProblem({ title: ' ', start: today, days: 7 }, today)).toBe('title');
  });

  it('changes dates only while not over and never to an end before today', () => {
    expect(newDatesProblem(span, { start: d('2026-11-20'), days: 7 }, today)).toBe('endBeforeToday');
    // Ending today is fine.
    expect(newDatesProblem(span, { start: d('2026-11-21'), days: 7 }, today)).toBeNull();
    expect(newDatesProblem(span, { start: d('2026-11-21'), days: 14 }, today)).toBeNull();
    expect(newDatesProblem({ start_date: '2026-10-01', end_date: '2026-10-28' }, { start: today, days: 7 }, today)).toBe('over');
  });

  it('ends early only while running and after the start day, on the day before', () => {
    expect(canEndEarly(span, today)).toBe(true);
    expect(canEndEarly(span, d('2026-11-19'))).toBe(false);
    expect(canEndEarly(span, d('2026-11-20'))).toBe(false);
    expect(canEndEarly(span, d('2026-11-21'))).toBe(true);
    expect(canEndEarly(span, d('2026-12-18'))).toBe(false);
    expect(earlyEndDate(span, today)).toBe('2026-11-26');
    expect(earlyEndDate(span, d('2026-11-21'))).toBe('2026-11-20');
    expect(endDateAfterNo(span, d('2026-11-21'))).toBe('2026-11-20');
    expect(endDateAfterNo(span, d('2026-11-20'))).toBe('2026-11-20');
  });

  it('treats an experiment a "no" ended on its start day as over at once', () => {
    // A "no" on the start day ends it there: one day, the start day, which is today.
    const ended = { start_date: '2026-11-27', end_date: '2026-11-27', check_in: true };
    expect(endDateAfterNo({ start_date: '2026-11-27', end_date: '2026-12-24' }, today)).toBe('2026-11-27');
    expect(experimentState(ended, d('2026-11-26'))).toBe('planned');
    expect(experimentState(ended, today)).toBe('over');
    expect(canEndEarly(ended, today)).toBe(false);
    expect(canAnswer(ended, today, today)).toBe(false);
    expect(askingOn([ended], today, today)).toEqual([]);
    expect(newDatesProblem(ended, { start: today, days: 28 }, today)).toBe('over');
    // Any longer experiment still runs on its last day.
    expect(experimentState({ start_date: '2026-11-26', end_date: '2026-11-27' }, today)).toBe('running');
  });

  it('finds overlaps of at least one day', () => {
    expect(overlaps(span, { start_date: '2026-12-17', end_date: '2026-12-31' })).toBe(true);
    expect(overlaps(span, { start_date: '2026-12-18', end_date: '2026-12-31' })).toBe(false);
    expect(overlaps(span, { start_date: '2026-11-01', end_date: '2026-11-20' })).toBe(true);
  });

  it('takes answers in the span and not after today', () => {
    expect(canAnswer(span, d('2026-11-20'), today)).toBe(true);
    expect(canAnswer(span, d('2026-11-19'), today)).toBe(false);
    expect(canAnswer(span, d('2026-11-28'), today)).toBe(false);
    const list = [
      { ...span, id: 1, check_in: true },
      { ...span, id: 2, check_in: false },
      { start_date: '2026-11-28', end_date: '2026-12-31', id: 3, check_in: true },
    ];
    expect(askingOn(list, today, today).map((row) => row.id)).toEqual([1]);
  });

  it('asks no more once the experiment is over, not even for its old days (E17)', () => {
    const over = { start_date: '2026-11-01', end_date: '2026-11-26', check_in: true };
    expect(canAnswer(over, d('2026-11-10'), d('2026-11-26'))).toBe(true);
    expect(canAnswer(over, d('2026-11-10'), today)).toBe(false);
    expect(canAnswer(over, d('2026-11-26'), today)).toBe(false);
    expect(askingOn([over], d('2026-11-10'), today)).toEqual([]);
  });

  it('keys an experiment by folded title and start', () => {
    expect(experimentKey({ title: ' Kein Kaffee ', start_date: '2026-11-20' })).toBe(experimentKey({ title: 'kein kaffee', start_date: '2026-11-20' }));
    expect(experimentKey({ title: 'Kein Kaffee', start_date: '2026-11-21' })).not.toBe(experimentKey({ title: 'Kein Kaffee', start_date: '2026-11-20' }));
  });
});
