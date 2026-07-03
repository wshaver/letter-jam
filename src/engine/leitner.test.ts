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

it('difficulty steps up on reaching box 4 and again at box 5, then caps', () => {
  let s = newWordState();
  s = recordResult(s, true); // box 2
  s = recordResult(s, true); // box 3
  expect(s.choiceCount).toBe(MIN_CHOICES);
  expect(s.decoyNearness).toBe(0);
  s = recordResult(s, true); // box 4 → step up
  expect(s.choiceCount).toBe(4);
  expect(s.decoyNearness).toBeCloseTo(0.4);
  s = recordResult(s, true); // box 5 → step up again
  expect(s.choiceCount).toBe(MAX_CHOICES);
  expect(s.decoyNearness).toBeCloseTo(MAX_NEARNESS);
  s = recordResult(s, true); // stays box 5, already capped
  expect(s.choiceCount).toBe(MAX_CHOICES);
  expect(s.decoyNearness).toBeCloseTo(MAX_NEARNESS);
});

it('two misses in a row step difficulty down and reset the streak', () => {
  let s: WordState = { ...newWordState(), box: 5, choiceCount: 5, decoyNearness: 0.8 };
  s = recordResult(s, false);
  expect(s.missStreak).toBe(1);
  expect(s.choiceCount).toBe(5); // a single miss does not ease
  s = recordResult(s, false);
  expect(s.choiceCount).toBe(4);
  expect(s.decoyNearness).toBeCloseTo(0.4);
  expect(s.missStreak).toBe(0); // takes another 2 misses to ease again
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
