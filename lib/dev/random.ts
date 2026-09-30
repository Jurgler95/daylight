/** Deterministic PRNG (mulberry32) so seeded data is reproducible in tests. */
export function createRandom(seed: number) {
  let state = seed >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number): number => min + Math.floor(next() * (max - min + 1)),
    chance: (p: number): boolean => next() < p,
    pick: <T>(items: readonly T[]): T => {
      const item = items[Math.floor(next() * items.length)];
      if (item === undefined) throw new Error('pick from empty list');
      return item;
    },
    /** Roughly normal via sum of uniforms, clamped. */
    normal: (mean: number, sd: number, min: number, max: number): number => {
      const u = next() + next() + next() + next() - 2;
      return Math.min(max, Math.max(min, mean + u * sd * 1.7));
    },
  };
}

export type Random = ReturnType<typeof createRandom>;
