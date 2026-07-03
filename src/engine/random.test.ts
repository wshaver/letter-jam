import { weightedPick, shuffle, type Rng } from './random';

// Deterministic RNG helper
function seeded(seed: number): Rng {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

it('weightedPick returns the sole item', () => {
  expect(weightedPick(['x'], () => 1, seeded(1))).toBe('x');
});

it('weightedPick favors heavier items over many draws', () => {
  const rng = seeded(42);
  const counts = { a: 0, b: 0 };
  for (let i = 0; i < 1000; i++) {
    const pick = weightedPick(['a', 'b'], (x) => (x === 'a' ? 9 : 1), rng);
    counts[pick as 'a' | 'b']++;
  }
  expect(counts.a).toBeGreaterThan(counts.b * 3);
});

it('weightedPick throws on an empty array', () => {
  expect(() => weightedPick([], () => 1, seeded(1))).toThrow('weightedPick on empty array');
});

it('shuffle preserves all elements without mutating input', () => {
  const input = [1, 2, 3, 4, 5];
  const out = shuffle(input, seeded(7));
  expect(out).toHaveLength(5);
  expect([...out].sort()).toEqual([1, 2, 3, 4, 5]);
  expect(input).toEqual([1, 2, 3, 4, 5]);
});
