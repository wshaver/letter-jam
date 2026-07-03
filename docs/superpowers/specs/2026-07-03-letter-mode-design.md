# Letter Mode — Design Spec

**Date:** 2026-07-03
**Status:** Approved for planning
**Extends:** 2026-07-02-letter-jam-design.md, 2026-07-03-sentence-audio-design.md
**Depends on:** the sentence-audio feature (requires `Word.sentence` and the
build-time sentence validator). Implement after that branch merges to main.

## Summary

A super-easy mode for pre-readers (~age 3) that drills **letter recognition,
upper and lowercase**, in the same gameplay: a letter is spoken ("A. A is for
apple. A."), 3–5 letter cards fall, the child taps the match. Letters are
dictionary entries, so the Leitner engine, per-item difficulty, trickle
progression, celebrations, and prompt machinery all work unchanged.

## Mode Selection

- `Profile.settings` gains `gameMode: 'words' | 'letters'` (default
  `'words'`). A grown-up flips it in Settings (alongside the wrongAnswerMode
  toggle).
- The play pool filters by mode; no other UI navigation changes. Switching
  modes preserves all progress (letter and word states coexist in the same
  profile; the inactive kind is simply ignored).

## Letters as Dictionary Entries

- The build script generates **52 letter entries**:
  - ids `letter-a-uc` … `letter-z-uc` with `text: 'A'` … `'Z'`,
    `tags: ['letter', 'upper']`
  - ids `letter-a-lc` … `letter-z-lc` with `text: 'a'` … `'z'`,
    `tags: ['letter', 'lower']`
  - (`text` is the single glyph — the one deliberate exception to the
    "stored lowercase" convention, since case IS the content.)
- **Two new grade bands** prepend the `Grade` union and `GRADES` order:
  `'lettersUpper'`, `'lettersLower'`, then `preK` … `3`. Uppercase
  introduces first; when mastery crosses the existing trickle threshold,
  lowercase trickles in — the same mechanic that graduates word grades.
- Each glyph is an independent Leitner item: knowing `A` and knowing `a`
  are tracked (and celebrated) separately.

## Pool Filtering

- Letters mode pool: entries whose `tags` include `'letter'`. Words mode
  pool: entries without the `'letter'` tag (words mode behavior is
  unchanged).
- **Progression calculations consider only the active pool:** the
  introduce/trickle logic must count introduced/mastered items against the
  pool it is introducing from, not the profile's whole progress map (a
  words-mode profile with old letter progress must not have its word
  trickle skewed by letter states, and vice versa).

## Case Exclusion

Hearing "A" matches both glyphs, so `A` and `a` must never share a screen.
The decoy filter excludes candidates whose text equals the target's text
**case-insensitively** (the existing homophone check misses this because it
lowercases before comparing). This rule is a no-op for words (no two words
differ only by case) and is exactly right for letters.

## Letter Confusability (decoy similarity)

`similarity(a, b)` delegates to a **letter-confusion table** when both
inputs are single characters. Visual confusion groups (initial values,
tunable):

- lowercase: `{b d p q}`, `{m w}`, `{n u}`, `{i l j}`, `{c e o}`, `{a o}`,
  `{f t}`, `{h n}`, `{v y w}`, `{s z}`, `{g q}`
- uppercase: `{O Q C G}`, `{E F}`, `{M W}`, `{N Z}`, `{I L J T}`,
  `{U V Y}`, `{P R B D}`, `{K X}`

Scoring: same group → high (~0.9); different group → low (~0.1). Low
`decoyNearness` yields visually distinct decoys (A vs x vs o); high yields
the classic confusions (b vs d vs p). The per-item difficulty ramp
(choiceCount 3→5, nearness stepping at box ≥ 4) applies to letters exactly
as it does to words.

## Audio

- Reuses `wordPrompt(text, sentence)` verbatim: **"A. A is for apple. A."**
  (`wordPrompt` capitalizes the leading/trailing token, so the lowercase
  entry speaks identically — correct: the sound is the identity, the glyph
  is what's tested.)
- Letter sentences use the template **"X is for ⟨flagship⟩."** with
  flagship words drawn from the game vocabulary (a→apple, b→ball, c→cat,
  d→dog, e→egg, f→fish, g→garden, h→house, j→jump, k→kitty, l→letter,
  m→milk, n→nest, o→open, p→pig, r→rabbit, s→sun, t→tree, u→up, v→very,
  w→water, y→yellow).
- **`LETTER_FLAGSHIPS` allowance list** for letters with no suitable
  vocabulary word: q→queen, z→zoo, i→ice, and x uses the pattern
  **"We find x in fox."** (fox allowed). These flagship-only words appear in
  letter sentences ONLY — never as cards, never in word sentences.
- **Validation:** letter sentences are validated by their own template
  rules (contains the letter as a standalone token; flagship from the
  vocabulary or the allowance list) and are exempt from the word rules'
  "target not first" requirement — the template naturally leads with the
  letter. Both uppercase and lowercase entries share the same sentence
  text.

## Presentation

- Single-glyph cards render extra large (CSS rule keyed on 1-character
  card text). Everything else — falling cards, celebration tiers,
  keepTrying default, reveal-on-miss — is identical to word mode.

## Data Model Changes

```ts
type Grade = 'lettersUpper' | 'lettersLower' | 'preK' | 'K' | '1' | '2' | '3';

interface ProfileSettings {
  wrongAnswerMode: 'keepTrying' | 'oneAndDone';
  gameMode: 'words' | 'letters';   // default 'words'
}
```

Existing save blobs lack `gameMode`; loading defaults it to `'words'`
(no migration — a defaulting read is enough).

## What Doesn't Change

Leitner rules, per-item difficulty stepping, celebration tiers, storage
interface, profile select, TTS voice selection, word-mode behavior.

## Future (reserved, not built)

- **Font variants as a difficulty knob** (deferred by decision 2026-07-03):
  rotate a card's glyph/word through different typefaces as its box climbs —
  valuable app-wide (letters AND words; font-reading is a common struggle
  even for ~6-year-olds). One considered approach: separate Leitner items
  per font (4 copies of "dog", one per font, each with its own box) — most
  thorough, but multiplies the item pool ~4× and may be more annoying than
  useful. A lighter approach (per-item font rotation without separate
  tracking) may be the better start. Decide when picked up.
- Mode auto-graduation: nudge or auto-switch a letters profile to words
  once lowercase mastery is high.

## Risks / Decisions

1. **Confusion-table quality** drives how "gently harder" letter decoys
   feel; initial values above are reasonable but should be tuned with a
   real child playing.
2. **TTS letter names** ("A", "W") render clearly in Chrome's Google US
   English; the flagship sentence reinforces the name either way.
3. **`text` uppercase exception** to the lowercase convention is contained
   to letter entries and display code never assumed case anyway.
