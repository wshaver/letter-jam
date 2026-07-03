import { activePool, pickDecoys, buildRound } from './roundBuilder';
import { createProfile } from './profiles';
import { newWordState } from './leitner';
import type { Difficulty, Word } from './types';
import type { Rng } from './random';

function seeded(seed: number): Rng {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const W = (id: string): Word => ({ id, text: id, grade: 'preK', length: id.length, sentence: `We can see the ${id} now.` });
// 9 confusable 3-letter decoys + 9 clearly-different longer decoys, so the
// selection window (size 9 for choiceCount 4) lands on disjoint ends.
const NEAR = ['cot', 'can', 'car', 'cap', 'cab', 'bat', 'hat', 'mat', 'rat'];
const FAR = ['banana', 'house', 'purple', 'orange', 'yellow', 'monkey', 'flower', 'guitar', 'rocket'];
const WORDS = ['cat', ...NEAR, ...FAR].map(W);

function profileWith(ids: string[]) {
  const p = createProfile('id', 'A', '🦄');
  for (const id of ids) p.progress.words[id] = newWordState();
  return p;
}

it('activePool contains only introduced words', () => {
  const p = profileWith(['cat', 'cot']);
  expect(activePool(p, WORDS).map((w) => w.id).sort()).toEqual(['cat', 'cot']);
});

it('near difficulty picks confusable decoys, far picks different ones', () => {
  const target = W('cat');
  const near: Difficulty = { choiceCount: 4, decoyNearness: 1 };
  const far: Difficulty = { choiceCount: 4, decoyNearness: 0 };
  const nearIds = pickDecoys(target, WORDS, near, seeded(1)).map((w) => w.id);
  const farIds = pickDecoys(target, WORDS, far, seeded(1)).map((w) => w.id);
  // near decoys are the short, cat-like words; far decoys are the long ones
  expect(nearIds.every((id) => id.length === 3)).toBe(true);
  expect(farIds.every((id) => id.length >= 5)).toBe(true);
});

it('decoys never include homophones of the target', () => {
  const target = W('to');
  const words = ['to', 'too', 'two', 'the', 'look', 'play', 'see', 'go', 'run', 'and'].map(W);
  for (let seed = 0; seed < 20; seed++) {
    const near: Difficulty = { choiceCount: 5, decoyNearness: 1 };
    const ids = pickDecoys(target, words, near, seeded(seed)).map((w) => w.id);
    expect(ids).not.toContain('too');
    expect(ids).not.toContain('two');
  }
});

it("buildRound uses the target word's own difficulty and includes the target", () => {
  const p = profileWith(['cat']);
  p.progress.words['cat'].choiceCount = 4;
  p.progress.words['cat'].decoyNearness = 0.5;
  const round = buildRound(p, WORDS, seeded(3));
  expect(round.target.id).toBe('cat');
  expect(round.choices).toHaveLength(4); // the word's own choiceCount
  expect(round.choices).toContainEqual(round.target);
  const ids = round.choices.map((c) => c.id);
  expect(new Set(ids).size).toBe(4);
});

it('never repeats the previous target when another word is available', () => {
  const p = profileWith(['cat', 'cot']);
  for (let seed = 0; seed < 20; seed++) {
    expect(buildRound(p, WORDS, seeded(seed), 'cat').target.id).toBe('cot');
  }
});

it('allows a repeat when the previous target is the only introduced word', () => {
  const p = profileWith(['cat']);
  expect(buildRound(p, WORDS, seeded(5), 'cat').target.id).toBe('cat');
});

it('returns all candidates when the pool is smaller than requested', () => {
  const target = W('cat');
  const words = [W('cat'), W('cot'), W('can')];
  const decoys = pickDecoys(target, words, { choiceCount: 5, decoyNearness: 0.5 }, seeded(1));
  expect(decoys.map((w) => w.id).sort()).toEqual(['can', 'cot']);
});

it('never shows the other case of the target letter', () => {
  const upper: Word = { id: 'letter-a-uc', text: 'A', grade: 'lettersUpper', length: 1, sentence: 'A is for apple.', tags: ['letter', 'upper'] };
  const lower: Word = { id: 'letter-a-lc', text: 'a', grade: 'lettersLower', length: 1, sentence: 'A is for apple.', tags: ['letter', 'lower'] };
  const others = ['B', 'C', 'D', 'E'].map((t) => ({ id: `letter-${t.toLowerCase()}-uc`, text: t, grade: 'lettersUpper' as const, length: 1, sentence: `${t} is for x.`, tags: ['letter', 'upper'] }));
  const pool = [upper, lower, ...others];
  for (let seed = 0; seed < 20; seed++) {
    const ids = pickDecoys(upper, pool, { choiceCount: 5, decoyNearness: 0.5 }, seeded(seed)).map((w) => w.id);
    expect(ids).not.toContain('letter-a-lc');
  }
});
