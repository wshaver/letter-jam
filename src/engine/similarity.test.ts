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

it('scores single characters by visual confusion group', () => {
  expect(similarity('b', 'd')).toBe(0.9); // same lowercase group
  expect(similarity('B', 'D')).toBe(0.9); // same uppercase group
  expect(similarity('b', 'D')).toBe(0.1); // groups are case-specific
  expect(similarity('A', 'x')).toBe(0.1); // unrelated
  expect(similarity('a', 'a')).toBe(1);
});
