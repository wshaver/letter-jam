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

it('includes Dolch nouns with length-banded grades and the noun tag', () => {
  expect(allWords().length).toBe(313);
  expect(wordById('dog')).toMatchObject({ grade: 'preK', tags: ['noun'] });
  expect(wordById('ball')).toMatchObject({ grade: 'K', tags: ['noun'] });
  expect(wordById('house')).toMatchObject({ grade: '1', tags: ['noun'] });
  expect(wordById('window')).toMatchObject({ grade: '2', tags: ['noun'] });
  expect(wordById('christmas')).toMatchObject({ grade: '3', tags: ['noun'] });
  expect(wordById('the')?.tags).toBeUndefined(); // service words untagged
});

it('every word carries a capitalized, period-terminated sentence containing it', () => {
  for (const w of allWords()) {
    expect(w.sentence, w.id).toMatch(/^[A-Z].*\.$/);
    // Smoke check only — the authoritative word-boundary validation runs in build-words.mjs.
    expect(w.sentence.toLowerCase(), w.id).toContain(w.text);
  }
});
