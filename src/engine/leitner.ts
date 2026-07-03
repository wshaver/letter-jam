import type { Box, WordState } from './types';

export const NUM_BOXES = 5;
export const MISS_DROP = 2; // a miss drops this many boxes (floor 1)
export const MIN_CHOICES = 3;
export const MAX_CHOICES = 5;
export const NEARNESS_STEP = 0.4;
export const MAX_NEARNESS = 0.8;
export const HARDER_BOX = 4; // reaching this box (or higher) steps difficulty up
export const MISSES_TO_EASE = 2; // consecutive misses that step difficulty down

export function newWordState(): WordState {
  return {
    box: 1,
    seen: 0,
    correct: 0,
    introduced: true,
    choiceCount: MIN_CHOICES,
    decoyNearness: 0,
    missStreak: 0,
  };
}

export function recordResult(state: WordState, correctFirstTry: boolean): WordState {
  const seen = state.seen + 1;
  if (correctFirstTry) {
    const box = Math.min(state.box + 1, NUM_BOXES) as Box;
    const harder = box >= HARDER_BOX;
    return {
      box,
      seen,
      correct: state.correct + 1,
      introduced: true,
      choiceCount: harder ? Math.min(state.choiceCount + 1, MAX_CHOICES) : state.choiceCount,
      decoyNearness: harder
        ? Math.min(state.decoyNearness + NEARNESS_STEP, MAX_NEARNESS)
        : state.decoyNearness,
      missStreak: 0,
    };
  }
  const missStreak = state.missStreak + 1;
  const ease = missStreak >= MISSES_TO_EASE;
  return {
    box: Math.max(1, state.box - MISS_DROP) as Box,
    seen,
    correct: state.correct,
    introduced: true,
    choiceCount: ease ? Math.max(state.choiceCount - 1, MIN_CHOICES) : state.choiceCount,
    decoyNearness: ease ? Math.max(state.decoyNearness - NEARNESS_STEP, 0) : state.decoyNearness,
    missStreak: ease ? 0 : missStreak,
  };
}

export function boxWeight(box: Box): number {
  // box 1 -> 16, box 2 -> 8, ... box 5 -> 1
  return 2 ** (NUM_BOXES - box);
}
