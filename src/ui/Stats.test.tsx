import { render, screen } from '@testing-library/react';
import { Stats } from './Stats';
import { createProfile } from '../engine/profiles';
import { newWordState } from '../engine/leitner';
import type { Word } from '../engine/types';

const W = (id: string): Word => ({ id, text: id, grade: 'preK', length: id.length, sentence: `We can see the ${id} now.` });
const WORDS = ['cat', 'cot', 'can', 'car', 'dog', 'sun'].map(W);

it('shows streak, stars, pool, mastered, and rounds', () => {
  const p = createProfile('id', 'A', '🦄');
  for (const w of WORDS) p.progress.words[w.id] = newWordState();
  p.progress.stats = { rounds: 12, correctFirstTry: 9, streak: 4 };
  p.progress.words['cat'].box = 5; // one mastered word in the pool
  render(<Stats profile={p} words={WORDS} />);
  expect(screen.getByTitle('Correct in a row')).toHaveTextContent('🔥 4');
  expect(screen.getByTitle('First-try wins')).toHaveTextContent('⭐ 9');
  expect(screen.getByTitle('Words in the pool')).toHaveTextContent(`📚 ${WORDS.length}`);
  expect(screen.getByTitle('Mastered')).toHaveTextContent('🏆 1');
  expect(screen.getByTitle('Rounds played')).toHaveTextContent('🎲 12');
});

it('counts only introduced pool words', () => {
  const p = createProfile('id', 'A', '🦄');
  p.progress.words['cat'] = newWordState();
  p.progress.words['out-of-pool'] = newWordState(); // not in the words prop
  render(<Stats profile={p} words={WORDS} />);
  expect(screen.getByTitle('Words in the pool')).toHaveTextContent('📚 1');
});
