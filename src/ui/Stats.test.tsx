import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
  expect(screen.getByTitle('Correct answers in a row')).toHaveTextContent('🔥 4');
  expect(screen.getByTitle('First-try wins, all time')).toHaveTextContent('⭐ 9');
  expect(screen.getByTitle('Words in the learning pile')).toHaveTextContent(`📚 ${WORDS.length}`);
  expect(screen.getByTitle('Words known really well')).toHaveTextContent('🏆 1');
  expect(screen.getByTitle('Rounds played')).toHaveTextContent('🎲 12');
});

it('counts only introduced pool words', () => {
  const p = createProfile('id', 'A', '🦄');
  p.progress.words['cat'] = newWordState();
  p.progress.words['out-of-pool'] = newWordState(); // not in the words prop
  render(<Stats profile={p} words={WORDS} />);
  expect(screen.getByTitle('Words in the learning pile')).toHaveTextContent('📚 1');
});

it('shows a tooltip bubble on tap and hides it on a second tap', async () => {
  const user = userEvent.setup();
  const p = createProfile('id', 'A', '🦄');
  render(<Stats profile={p} words={WORDS} />);
  await user.click(screen.getByTitle('Correct answers in a row'));
  expect(screen.getByRole('tooltip')).toHaveTextContent('Correct answers in a row');
  await user.click(screen.getByTitle('Correct answers in a row'));
  expect(screen.queryByRole('tooltip')).toBeNull();
});

it('says Letters for a letters-mode pool', () => {
  const letters: Word[] = [
    { id: 'letter-a-uc', text: 'A', grade: 'lettersUpper', length: 1, sentence: 'A is for apple.', tags: ['letter', 'upper'] },
  ];
  const p = createProfile('id', 'A', '🦄');
  p.progress.words['letter-a-uc'] = newWordState();
  render(<Stats profile={p} words={letters} />);
  expect(screen.getByTitle('Letters in the learning pile')).toHaveTextContent('📚 1');
});
