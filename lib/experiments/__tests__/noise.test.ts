import { addDaysToDateString, type DateString } from '@/lib/dates';

import { NOISE_MAX_DAYS, noiseCheck } from '../noise';

const start = '2026-06-01' as DateString;

/** Same numbers on every run. */
function random(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

/** `history` days before the start and `during` days from it, values from `value(i, inExperiment)`; null leaves a gap. */
function series(history: number, during: number, value: (i: number, inExperiment: boolean) => number | null): Map<string, number> {
  const map = new Map<string, number>();
  for (let i = -history; i < during; i++) {
    const v = value(i, i >= 0);
    if (v !== null) map.set(addDaysToDateString(start, i), v);
  }
  return map;
}

describe('noiseCheck', () => {
  it('calls a difference like the usual ups and downs "usual"', () => {
    const next = random(7);
    const result = noiseCheck({ series: series(600, 28, () => 3 + (next() - 0.5) * 2), start, beforeLength: 28, duringLength: 28, minDays: 7 })!;
    expect(result.verdict).toMatchObject({ kind: 'usual', preliminary: false });
  });

  it('calls a clear jump exactly at the start "larger than usual"', () => {
    const next = random(11);
    const result = noiseCheck({ series: series(600, 28, (_, inside) => (inside ? 4.5 : 3) + (next() - 0.5)), start, beforeLength: 28, duringLength: 28, minDays: 7 })!;
    expect(result.difference).toBeGreaterThan(1);
    expect(result.verdict).toMatchObject({ kind: 'larger', share: 0, preliminary: false });
  });

  it('cannot judge with a short history', () => {
    const result = noiseCheck({ series: series(60, 28, () => 3), start, beforeLength: 28, duringLength: 28, minDays: 7 })!;
    expect(result.verdict).toEqual({ kind: 'unjudgeable' });
  });

  it('marks a medium history as preliminary', () => {
    const next = random(3);
    // Days s from 28 to 172 before the start: 145 days, between 2 and 4 times 56.
    const result = noiseCheck({ series: series(200, 28, (_, inside) => (inside ? 5 : 2) + next()), start, beforeLength: 28, duringLength: 28, minDays: 7 })!;
    expect(result.verdict).toMatchObject({ kind: 'larger', preliminary: true, pairs: 145 });
  });

  it('never lets a pair reach into the experiment', () => {
    // Flat before, a jump in the experiment only: any pair touching it would differ as much.
    const result = noiseCheck({ series: series(400, 28, (_, inside) => (inside ? 5 : 3)), start, beforeLength: 28, duringLength: 28, minDays: 7 })!;
    expect(result.verdict).toMatchObject({ kind: 'larger', share: 0, pairs: 400 - 28 - 28 + 1 });
  });

  it('works with a shortened "Davor" and caps the days s', () => {
    const next = random(5);
    const result = noiseCheck({ series: series(1200, 28, () => 3 + next()), start, beforeLength: 10, duringLength: 28, minDays: 7 })!;
    expect(result.verdict).toMatchObject({ kind: 'usual', pairs: NOISE_MAX_DAYS });
  });

  it('skips gaps and leaves a value out when the real pair has too few days', () => {
    const next = random(9);
    // Every third day missing: windows of 28 days still hold about 18 values.
    const gappy = noiseCheck({ series: series(600, 28, (i) => (((i % 3) + 3) % 3 === 0 ? null : 3 + next())), start, beforeLength: 28, duringLength: 28, minDays: 7 })!;
    expect(gappy.verdict.kind).toBe('usual');
    // Only five values in the experiment.
    expect(noiseCheck({ series: series(600, 28, (i, inside) => (inside && i >= 5 ? null : 3)), start, beforeLength: 28, duringLength: 28, minDays: 7 })).toBeNull();
    // Nothing before the start.
    expect(noiseCheck({ series: series(0, 28, () => 3), start, beforeLength: 28, duringLength: 28, minDays: 7 })).toBeNull();
  });

  it('ignores days after the experiment', () => {
    const base = series(400, 28, (_, inside) => (inside ? 5 : 3));
    const later = new Map(base);
    for (let i = 28; i < 60; i++) later.set(addDaysToDateString(start, i), 1);
    const input = { start, beforeLength: 28, duringLength: 28, minDays: 7 };
    expect(noiseCheck({ ...input, series: later })).toEqual(noiseCheck({ ...input, series: base }));
  });
});
