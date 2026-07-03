import type { WordState } from './types';
import {
  newWordState,
  recordResult,
  boxWeight,
  NUM_BOXES,
  MIN_CHOICES,
  MAX_CHOICES,
  MAX_NEARNESS,
} from './leitner';

it('new words start in box 1 at the easiest difficulty', () => {
  const s = newWordState();
  expect(s.box).toBe(1);
  expect(s.introduced).toBe(true);
  expect(s.choiceCount).toBe(MIN_CHOICES);
  expect(s.decoyNearness).toBe(0);
  expect(s.missStreak).toBe(0);
});

it('correct first try moves up one box, clamped at max', () => {
  let s = newWordState();
  s = recordResult(s, true);
  expect(s.box).toBe(2);
  for (let i = 0; i < 10; i++) s = recordResult(s, true);
  expect(s.box).toBe(NUM_BOXES);
  expect(s.correct).toBeGreaterThan(0);
});

it('a miss drops two boxes, with a floor at box 1', () => {
  let s: WordState = { ...newWordState(), box: 5, seen: 4, correct: 4 };
  s = recordResult(s, false);
  expect(s.box).toBe(3); // a slip on a known word: moderate comeback
  s = recordResult(s, false);
  expect(s.box).toBe(1); // second consecutive miss: full attention
  s = recordResult(s, false);
  expect(s.box).toBe(1); // floor
  expect(s.seen).toBe(7);
});

it('nearness rises 0.1 on every correct; choiceCount still steps at box >= 4', () => {
  let s = newWordState();
  s = recordResult(s, true); // box 2
  expect(s.decoyNearness).toBeCloseTo(0.1);
  expect(s.choiceCount).toBe(MIN_CHOICES);
  s = recordResult(s, true); // box 3
  expect(s.decoyNearness).toBeCloseTo(0.2);
  expect(s.choiceCount).toBe(MIN_CHOICES);
  s = recordResult(s, true); // box 4 -> choiceCount steps
  expect(s.decoyNearness).toBeCloseTo(0.3);
  expect(s.choiceCount).toBe(4);
  s = recordResult(s, true); // box 5
  expect(s.decoyNearness).toBeCloseTo(0.4);
  expect(s.choiceCount).toBe(MAX_CHOICES);
  for (let i = 0; i < 10; i++) s = recordResult(s, true);
  expect(s.decoyNearness).toBe(MAX_NEARNESS); // capped, clean 1-decimal value
  expect(s.choiceCount).toBe(MAX_CHOICES);
});

it('two misses in a row ease difficulty and reset the streak', () => {
  let s: WordState = { ...newWordState(), box: 5, choiceCount: 5, decoyNearness: 0.8 };
  s = recordResult(s, false);
  expect(s.missStreak).toBe(1);
  expect(s.decoyNearness).toBeCloseTo(0.8); // single miss does not ease
  s = recordResult(s, false);
  expect(s.decoyNearness).toBeCloseTo(0.5); // -0.3
  expect(s.choiceCount).toBe(4);
  expect(s.missStreak).toBe(0);
});

it('a correct answer resets the miss streak', () => {
  let s = recordResult(newWordState(), false);
  expect(s.missStreak).toBe(1);
  s = recordResult(s, true);
  expect(s.missStreak).toBe(0);
});

it('difficulty never goes below the floors', () => {
  let s = newWordState(); // already at floors
  for (let i = 0; i < 4; i++) s = recordResult(s, false);
  expect(s.choiceCount).toBe(MIN_CHOICES);
  expect(s.decoyNearness).toBe(0);
});

it('lower boxes weigh more than higher boxes', () => {
  expect(boxWeight(1)).toBeGreaterThan(boxWeight(5));
  expect(boxWeight(2)).toBeGreaterThan(boxWeight(3));
});
