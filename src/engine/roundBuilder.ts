import type { Difficulty, Profile, Round, Word } from './types';
import { boxWeight } from './leitner';
import { shuffle, weightedPick, type Rng } from './random';
import { similarity } from './similarity';
import { areHomophones } from './homophones';

export function activePool(profile: Profile, words: Word[]): Word[] {
  return words.filter((w) => profile.progress.words[w.id]?.introduced);
}

export function pickDecoys(target: Word, words: Word[], difficulty: Difficulty, rng: Rng): Word[] {
  const count = difficulty.choiceCount - 1;
  const scored = words
    .filter(
      (w) =>
        w.id !== target.id &&
        // The other case of the same glyph answers the same spoken prompt.
        w.text.toLowerCase() !== target.text.toLowerCase() &&
        // A homophone decoy would make the spoken target ambiguous — never show one.
        !areHomophones(target.text, w.text),
    )
    .map((w) => ({ w, s: similarity(target.text, w.text) }))
    .sort((a, b) => a.s - b.s); // ascending: least similar first
  const n = scored.length;
  // If the pool is smaller than requested, take all candidates — callers must not
  // assume a fixed choice count when the candidate pool is small.
  const candidates =
    n <= count
      ? scored.map((x) => x.w)
      : (() => {
          const center = Math.round(difficulty.decoyNearness * (n - 1));
          const windowSize = Math.min(n, Math.max(count * 3, count + 2));
          const start = Math.max(0, Math.min(center - Math.floor(windowSize / 2), n - windowSize));
          return shuffle(
            scored.slice(start, start + windowSize).map((x) => x.w),
            rng,
          );
        })();

  // Decoys must also be mutually distinct: two cases of the same glyph (H/h)
  // or a homophone pair (to/too) side by side confuse without teaching.
  const picked: Word[] = [];
  for (const w of candidates) {
    if (picked.length >= count) break;
    const clashes = picked.some(
      (p) => p.text.toLowerCase() === w.text.toLowerCase() || areHomophones(p.text, w.text),
    );
    if (!clashes) picked.push(w);
  }
  return picked;
}

export function buildRound(
  profile: Profile,
  words: Word[],
  rng: Rng,
  previousTargetId?: string,
): Round {
  let pool = activePool(profile, words);
  if (pool.length === 0) throw new Error('No introduced words to build a round');
  // Don't repeat the previous round's target (a child can win an immediate
  // repeat by echo, not reading) — unless it's the only word we have.
  if (previousTargetId && pool.length > 1) {
    pool = pool.filter((w) => w.id !== previousTargetId);
  }
  const target = weightedPick(pool, (w) => boxWeight(profile.progress.words[w.id].box), rng);
  const state = profile.progress.words[target.id];
  const difficulty: Difficulty = {
    choiceCount: state.choiceCount,
    decoyNearness: state.decoyNearness,
  };
  const decoys = pickDecoys(target, words, difficulty, rng);
  const choices = shuffle([target, ...decoys], rng);
  return { target, choices };
}
