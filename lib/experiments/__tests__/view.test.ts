import i18n from '@/lib/i18n';
import type { DateString } from '@/lib/dates';

import { experimentSections, experimentStatus, finishedToShow, lengthChoices, verdictPercent, verdictSentences, verdictShort } from '../view';

const today = '2026-11-27' as DateString;
const t = i18n.getFixedT('de');

describe('experiment view helpers', () => {
  it('sorts running and planned by start and the ones that are over by the latest end', () => {
    const list = [
      { id: 1, start_date: '2026-11-20', end_date: '2026-12-17' },
      { id: 2, start_date: '2026-12-01', end_date: '2026-12-07' },
      { id: 3, start_date: '2026-11-10', end_date: '2026-12-07' },
      { id: 4, start_date: '2026-11-28', end_date: '2026-12-25' },
      { id: 5, start_date: '2026-08-01', end_date: '2026-08-28' },
      { id: 6, start_date: '2026-09-01', end_date: '2026-09-07' },
      // Ended by a "no" on its start day, today.
      { id: 7, start_date: today, end_date: today },
    ];
    const sections = experimentSections(list, today);
    expect(sections.running.map((row) => row.id)).toEqual([3, 1]);
    expect(sections.planned.map((row) => row.id)).toEqual([4, 2]);
    expect(sections.over.map((row) => row.id)).toEqual([7, 6, 5]);
  });

  it('points the card on "Heute" to the one that ended last, unseen and at most 14 days ago', () => {
    const row = (id: number, start_date: string, end_date: string, result_seen = false) => ({ id, start_date, end_date, result_seen });
    expect(finishedToShow([], today)).toBeNull();
    // Running, seen, or ended too long ago: no card.
    expect(finishedToShow([row(1, '2026-11-01', '2026-11-28'), row(2, '2026-10-20', '2026-11-20', true), row(3, '2026-10-01', '2026-11-12')], today)).toBeNull();
    expect(finishedToShow([row(3, '2026-10-01', '2026-11-13')], today)?.id).toBe(3);
    expect(finishedToShow([row(4, '2026-10-20', '2026-11-20'), row(5, '2026-10-25', '2026-11-25'), row(6, '2026-10-01', '2026-11-14')], today)?.id).toBe(5);
    // A "no" on the start day ends it at once.
    expect(finishedToShow([row(5, '2026-10-25', '2026-11-25'), row(7, today, today)], today)?.id).toBe(7);
  });

  it('offers the weeks in days, plus a stored length that is no whole choice', () => {
    expect(lengthChoices(null)).toEqual([7, 14, 21, 28, 42, 56, 84]);
    expect(lengthChoices(28)).toEqual([7, 14, 21, 28, 42, 56, 84]);
    expect(lengthChoices(30)).toEqual([7, 14, 21, 28, 30, 42, 56, 84]);
  });

  it('says how far an experiment is', () => {
    const span = { start_date: '2026-11-20', end_date: '2026-12-17' };
    expect(experimentStatus(t, span, today)).toBe('Tag 8 von 28');
    expect(experimentStatus(t, span, '2026-11-19' as DateString)).toMatch(/^Beginnt am .*20\. November/);
    expect(experimentStatus(t, span, '2026-12-18' as DateString)).toBe('Lief 28 Tage');
  });

  it('never shows the same percentage for two verdicts at the threshold', () => {
    expect(verdictPercent({ kind: 'larger', share: 0.1 })).toMatch(/^10,0\s?%$/);
    expect(verdictPercent({ kind: 'usual', share: 73 / 729 })).toMatch(/^10,1\s?%$/);
    expect(verdictPercent({ kind: 'usual', share: 0.103 })).toMatch(/^10,3\s?%$/);
    expect(verdictPercent({ kind: 'larger', share: 0.004 })).toMatch(/^0,4\s?%$/);
    expect(verdictPercent({ kind: 'usual', share: 0.34 })).toMatch(/^34\s?%$/);
  });

  it('puts the verdict into words, "vorläufig" included', () => {
    expect(verdictShort(t, null)).toBeNull();
    expect(verdictSentences(t, null)).toEqual([]);
    expect(verdictShort(t, { kind: 'unjudgeable' })).toBe('nicht beurteilbar');
    const larger = { kind: 'larger' as const, share: 0.06, preliminary: false, pairs: 400 };
    expect(verdictShort(t, larger)).toMatch(/^größer als üblich, 6,0\s?%$/);
    expect(verdictShort(t, { ...larger, kind: 'usual', share: 0.34, preliminary: true })).toMatch(/^im Rahmen, 34\s?%, vorläufig$/);
    expect(verdictSentences(t, { ...larger, preliminary: true })).toEqual([expect.stringMatching(/nur in 6,0\s?% der Fälle/), expect.stringMatching(/^Vorläufig/)]);
    expect(verdictSentences(t, { kind: 'unjudgeable' })).toEqual([expect.stringMatching(/reicht die Zeit vor dem Experiment nicht\./)]);
  });
});
