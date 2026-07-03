import { allWords, wordsByGrade, wordById } from './words';

it('loads a substantial word list', () => {
  expect(allWords().length).toBeGreaterThanOrEqual(200);
});

it('groups known words by grade', () => {
  const preK = wordsByGrade('preK').map((w) => w.text);
  expect(preK).toContain('the');
  expect(preK).toContain('look');
});

it('looks up a word by id with computed length', () => {
  const w = wordById('the');
  expect(w?.grade).toBe('preK');
  expect(w?.length).toBe(3);
});
