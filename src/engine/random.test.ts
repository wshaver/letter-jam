import { shuffle, type Rng } from './random';

// Deterministic RNG helper
function seeded(seed: number): Rng {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

it('shuffle preserves all elements without mutating input', () => {
  const input = [1, 2, 3, 4, 5];
  const out = shuffle(input, seeded(7));
  expect(out).toHaveLength(5);
  expect([...out].sort()).toEqual([1, 2, 3, 4, 5]);
  expect(input).toEqual([1, 2, 3, 4, 5]);
});
