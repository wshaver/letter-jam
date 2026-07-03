import { levenshtein, similarity } from './similarity';

it('computes edit distance', () => {
  expect(levenshtein('cat', 'cot')).toBe(1);
  expect(levenshtein('cat', 'cat')).toBe(0);
  expect(levenshtein('cat', 'dog')).toBe(3);
});

it('rates confusable words higher than very different words', () => {
  expect(similarity('cat', 'cot')).toBeGreaterThan(similarity('cat', 'banana'));
  expect(similarity('cat', 'can')).toBeGreaterThan(similarity('cat', 'house'));
});

it('returns 1 for identical words', () => {
  expect(similarity('cat', 'cat')).toBe(1);
});
