import { orderedWords, introduceIfNeeded, DEFAULT_SESSION_CONFIG } from './session';
import { createProfile } from './profiles';
import type { Word } from './types';

const W = (id: string, grade: Word['grade'], length: number): Word => ({ id, text: id, grade, length });

const WORDS: Word[] = [
  W('go', 'preK', 2), W('the', 'preK', 3), W('look', 'preK', 4),
  W('see', 'preK', 3), W('big', 'preK', 3), W('down', 'preK', 4),
  W('play', 'preK', 4), W('came', 'K', 4), W('black', 'K', 5),
];

it('orders words by grade, then length, then alpha', () => {
  const first = orderedWords(WORDS)[0];
  expect(first.grade).toBe('preK');
  expect(first.length).toBe(2); // "go"
});

it('introduces the initial batch when nothing is introduced', () => {
  const p = introduceIfNeeded(createProfile('id', 'A', '🦄'), WORDS);
  const introduced = Object.values(p.progress.words).filter((s) => s.introduced);
  expect(introduced).toHaveLength(DEFAULT_SESSION_CONFIG.initialBatch);
});

it('does not introduce more until the mastery threshold is met', () => {
  const p0 = introduceIfNeeded(createProfile('id', 'A', '🦄'), WORDS);
  const before = Object.keys(p0.progress.words).length;
  const p1 = introduceIfNeeded(p0, WORDS); // still box 1, no mastery
  expect(Object.keys(p1.progress.words).length).toBe(before);
});

it('trickles in more words once enough are mastered', () => {
  let p = introduceIfNeeded(createProfile('id', 'A', '🦄'), WORDS);
  // Force all introduced words to a mastered box.
  for (const id of Object.keys(p.progress.words)) p.progress.words[id].box = 5;
  const before = Object.keys(p.progress.words).length;
  p = introduceIfNeeded(p, WORDS);
  expect(Object.keys(p.progress.words).length).toBeGreaterThan(before);
});
