# Sentence Audio + Noun Dictionary — Design Spec

**Date:** 2026-07-03
**Status:** Approved for planning
**Extends:** 2026-07-02-letter-jam-design.md

## Summary

Two coupled changes:

1. **The spoken prompt becomes a three-part sentence prompt.** Instead of
   "Find the word, dog!", the game speaks **"Dog. The red dog sat. Dog."** —
   the target word alone, a short context sentence containing it, then the
   word alone again. Every word in the dictionary gets one authored sentence.
2. **The Dolch 95 nouns join the dictionary as real target words** (93 after
   exclusions), fixing the service-list's "no nouns" gap and providing
   concrete, kid-friendly targets (dog, cake, sun).

## Prompt Format

- `wordPrompt(word, sentence)` returns `` `${Cap(word)}. ${sentence} ${Cap(word)}.` ``
  — e.g. `Dog. The red dog sat. Dog.` The sentence is stored already
  capitalized with a trailing period.
- The 🔊 replay button speaks the same full prompt.
- The word-alone bracketing keeps the target unambiguous even though the
  sentence contains other dictionary words; periods give the TTS natural
  pauses.
- **Accepted tradeoff:** isolated function words ("a", "the") TTS-render
  slightly oddly on their own — the mid-prompt sentence supplies the natural
  in-context pronunciation, which is better pedagogy than the old carrier
  phrase.

## Dictionary Expansion — Dolch 95 Nouns

- The Dolch noun list ships as `Word` entries: targets, Leitner-tracked,
  tagged `noun` (the reserved `tags` field's first real use).
- **Exclusions (2):** "Santa Claus" (two words — breaks single-word cards)
  and "good-bye" (hyphenated, dated spelling). **"christmas" stays**
  (stored lowercase like every other word). Net: **93 nouns, 313 words
  total.**
- **Grade banding by length** (the noun list has no official grades; length
  fits our existing difficulty spine): ≤3 letters → preK, 4 → K, 5 → 1,
  6 → 2, 7+ → 3. Nouns interleave with service words in introduction order.
- **New homophone groups** created by the nouns against existing words:
  **i/eye** and **would/wood**. Both added to `homophones.ts` so they never
  share a screen. (Both members of each pair are now real dictionary words.)
- **No save migration needed:** existing profiles simply see the new words
  as not-yet-introduced; the trickle introduces them in order.

## Sentences

- One sentence per dictionary word — **313 authored sentences** — stored as a
  `{ word: sentence }` map in `scripts/sentences.mjs`.
- **Authoring rules:**
  - Grammatically correct, kid-simple, roughly 3–8 words.
  - Contains the target word exactly (word-boundary match).
  - Target word is **not the first or last word** of the sentence, except
    for words where that is impractical; those go on a documented
    `EDGE_EXCEPTIONS` list in `sentences.mjs`.
  - Every token comes from the **allowed vocabulary**: the 313 dictionary
    words ∪ simple inflections of them ∪ a small explicit `EXTRA_FORMS`
    list of irregulars (e.g. `sat`).
- **Simple inflection rules** (applied by the validator when checking
  tokens): for any vocabulary word `w`, these forms are allowed —
  `w+s`, `w+es`, `w+d`, `w+ed`, `w+ing`, e-drop `-ing` (`come → coming`),
  final-consonant doubling `-ing`/`-ed` (`run → running`), and
  `y → ies`/`ied` (`baby → babies`). Anything else must be in
  `EXTRA_FORMS` or the build fails.

## Build-Time Validation

`build-words.mjs` **fails the build** if any word's sentence:

1. is missing;
2. does not contain the target word (word-boundary, case-insensitive);
3. starts or ends with the target word and the word is not in
   `EDGE_EXCEPTIONS`;
4. contains a token outside the allowed vocabulary (after stripping
   punctuation and lowercasing);
5. does not start with a capital letter and end with a period.

This makes the vocabulary constraint enforced, not aspirational, and keeps
future sentence edits honest.

## Code Changes

- `types.ts`: `Word` gains required `sentence: string`.
- `scripts/build-words.mjs`: adds the noun list (with length-banded grades
  and `tags: ['noun']`), merges sentences, runs the validator.
- `src/engine/homophones.ts`: add `['i', 'eye']` and `['would', 'wood']`.
- `src/engine/speech.ts`: `wordPrompt(word, sentence)` — new signature and
  format.
- `src/ui/useGame.ts`: passes `round.target.sentence` on round start and
  replay.
- Tests: `speech.test.ts` asserts the exact new format; `words.test.ts`
  count expectations (≥300, nouns present with correct banding);
  `homophones.test.ts` covers the new groups; `PlayScreen.test.tsx`'s
  prompt-parsing helper extracts the leading bracketed word; test fixture
  words gain `sentence` fields.

## What Doesn't Change

Round building, Leitner, per-word difficulty, trickle mechanics, storage,
profiles, celebration tiers. After merge, `npm run build` refreshes `dist/`
for the Apache vhost (which serves the built bundle, not the dev server).

## Risks / Decisions

1. **Authoring quality across 313 sentences** is the main risk. The
   validator catches every mechanical violation; a full human-readable
   review pass covers grammar and naturalness before commit.
2. **Length-banded noun grades are an invented curriculum** — accepted;
   length is already our fine-grained difficulty proxy.
3. **Isolated-word TTS pronunciation** returns for "a"/"the"-class words —
   accepted (see Prompt Format).
