# Letter Jam — Design Spec

**Date:** 2026-07-02
**Status:** Approved for planning

## Summary

Letter Jam is a lighthearted, touch-friendly web game that helps young children
practice letter reading, word recognition, and letter-sound association. The
child hears a word spoken aloud, then taps the matching written word among a few
gently falling choices. Correct taps are celebrated with confetti and balloons;
wrong taps fade away without punishment. Difficulty ramps automatically over
time, driven by a spaced-repetition (Leitner) engine and established
grade-level word lists.

The tone is always kind: the youngest children should win easily at first, and
every round should be able to end in celebration.

## Goals

- Practice **letter reading / word recognition** (Mode A, the initial mode).
- Ramp difficulty automatically as the child improves.
- Use **spaced repetition** so struggled-with words return sooner and mastered
  words fade to occasional review.
- Ground difficulty in **established, recognized grade-level word lists** rather
  than an invented curriculum.
- Support **multiple children** on one device without clobbering each other's
  progress.
- Keep it a **prototype**: no accounts, no backend, browser-native TTS.

## Non-Goals (for this prototype)

- **Not a dexterity game.** Motion is gentle and decorative; nobody loses because
  their finger was slow. No timers on tapping.
- No cloud accounts, login, or cross-device sync (storage is abstracted so this
  can be added later without touching game logic).
- No themed/phonics packs yet (the data model reserves a `tags` field for this
  future layer).
- No custom/cloud TTS yet (browser `SpeechSynthesis` only).

## Modes

- **Mode A — Listen & Find (initial):** The word is *only spoken*, not shown as
  the prompt. The child hears "cat" and taps the written word `cat` among decoys.
  Trains letter-sound → spelling recognition.
- **Mode C — Spell It (future mode):** The word is spoken and the child taps
  *letters in order* to build it. Same game, different mode. Designed for later;
  the data model and engine should not preclude it.

## Core Gameplay Loop (Mode A)

1. The round builder picks a **target word** (weighted toward low Leitner boxes
   and freshly introduced words) plus **N−1 decoys** at the target word's
   stored difficulty. The previous round's target is never picked again
   immediately, and decoys are never **homophones** of the target (TO/TOO/TWO
   on screen together would make the round unanswerable).
2. The word is spoken via TTS in a short **carrier phrase** — "Find the word,
   cat!" — because isolated function words ("a", "the") are frequently
   mispronounced on their own. A large **speaker button** lets the child replay
   it (this also satisfies browsers that require a user gesture before audio).
3. The word cards gently fall and settle onto the screen. Motion is decorative.
4. The child taps a card:
   - **Correct on first try →** confetti + balloons + happy chime; Leitner moves
     the word up one box.
   - **Wrong tap (keepTrying mode, default) →** the tapped card fades out, the
     others remain, and the child keeps trying until correct. The correct word
     triggers a minor celebration, but Leitner marks the word a **miss** 
     (back to box 1).
   - **Wrong tap (oneAndDone mode, optional) →** a gentle "aw," the correct
     card is briefly highlighted so the child still learns the answer, the
     round ends with no confetti, Leitner marks a miss, and play moves on.
5. Progress is autosaved. Sessions are **endless** — the child plays until they
   stop.

## Difficulty

Difficulty is tracked **per word** and stored with the word's progress in the
save blob. Each word carries two figures:

- **Choice count** (3–5): how many cards are on screen when this word is the
  target. Starts at **3**.
- **Decoy nearness** (0–0.8, in steps of 0.4): how confusable the decoys are.
  Starts at **0** — wildly different words (CAT vs. BANANA vs. HOUSE) — and
  tightens toward **confusable** (CAT vs. COT vs. CAN).

Adjustment rules (applied by the Leitner engine when a result is recorded):

- **Step up** when the word is answered correctly on the first try and lands in
  **box ≥ 4**: choice count +1 (capped at 5) and nearness +0.4 (capped at 0.8).
  So a word gets harder as it enters box 4 and again at box 5, then it's maxed.
- **Step down** when the word is missed **twice in a row**: choice count −1
  (floor 3) and nearness −0.4 (floor 0). The miss streak then resets, so it
  takes another two consecutive misses to step down again. Any correct answer
  also resets the streak.

A round's difficulty is simply the **target word's** stored difficulty. Word
length and grade rarity still provide the coarse spine (via the grade lists).

## Word Data & Packs

- **Source:** **Dolch sight words**, grouped by grade
  (Pre-K, K, 1st, 2nd, 3rd) — the classic "words your Nth grader should know"
  lists. Public domain. (Fry 1000 is a possible future extension for a longer
  tail but is out of scope for the first build.)
- Assembled at build-prep time into `src/data/words.json`.
- **Homophone groups:** a small table of homophones among (and near) the lists
  — to/too/two, there/their, for/four, no/know, by/buy, right/write, ate/eight,
  one/won, red/read, blue/blew, new/knew, be/bee, see/sea, our/hour — ships
  with the app. Words in the same group never appear together in one round.
- **Auto-advance with trickle:** the child auto-advances through grades. There is
  no hard graduation wall. Once a threshold fraction of the current grade's
  *introduced* words sit in a high box (box ≥ 4), the session logic seeds a few
  **next-grade** words (into box 1) so there is always a gentle stretch.

## Spaced Repetition — Leitner Boxes

- **5 boxes.** New words enter **box 1**.
- **Correct on first try → up one box** (seen less often).
- **Any wrong tap → back to box 1** (seen soon).
- The round builder draws targets by **weighted random**, heavily favoring low
  boxes (box 1 ≫ box 5), so struggling words return quickly and mastered words
  appear only occasionally.
- Implemented as **pure functions**, fully unit-tested. Not time/calendar based —
  works within and across sessions without depending on wall-clock intervals.

## Profiles & Storage

- **Multiple local profiles.** A "who's playing?" picker on launch (tap an
  avatar/emoji). Each child has independent Leitner state and settings.
- Everything is stored as a **single JSON blob** in `localStorage`.
- Access goes through a `ProfileStore` interface:
  ```ts
  interface ProfileStore {
    load(): Promise<SaveBlob>;
    save(blob: SaveBlob): Promise<void>;
  }
  ```
  `LocalStorageProfileStore` implements it today. A `ServerProfileStore` can be
  swapped in later with **zero changes** to game logic or UI.

## Text-to-Speech

- Browser `SpeechSynthesis`. **Preferred voice: Chrome's "Google US English"**,
  with graceful fallback to any available English voice on other browsers.
- Words are spoken inside the carrier phrase **"Find the word, \<word\>!"** —
  friendlier for kids and avoids the garbled pronunciation of isolated function
  words ("a", "the").
- **Heteronyms** ("read", "live", "use") may be pronounced with a different
  sense than intended; accepted as a prototype limitation.
- Voices load asynchronously and some browsers block audio until the first user
  gesture — the **speaker button** (tap to hear / replay) handles the gesture
  requirement and doubles as accessibility.
- All TTS concerns are isolated in `speech.ts`, so swapping in a cloud TTS later
  is a single-file change.

## Feedback & "Juice"

- **Correct:** `canvas-confetti`, floating balloons, a happy chime.
- **Correct after Wrong:** minor confetti, no baloons, a softer but still happy chime
- **Wrong:** a soft fade — no punishment, no scary sounds.
- Assets kept light.

## Architecture

React + Vite + TypeScript, single-page app. **Game logic lives in pure,
framework-free TypeScript modules**; React is only the view layer. This keeps the
engine fully unit-testable and independent of the renderer.

```
src/
  data/words.json            # Dolch list, generated at build-prep time
  engine/
    words.ts                 # load + query word data (by grade, length)
    leitner.ts               # pure box transitions + weighting
    similarity.ts            # word "confusability" scoring for decoys
    homophones.ts            # homophone groups (never co-shown in a round)
    roundBuilder.ts          # picks target + decoys for one round
    session.ts               # progression + grade "trickle" logic
    speech.ts                # TTS wrapper over SpeechSynthesis
  store/
    ProfileStore.ts          # interface: load()/save(blob)
    LocalStorageProfileStore.ts
  ui/
    App.tsx
    ProfileSelect.tsx
    PlayScreen.tsx
    Feedback.tsx             # confetti / balloons
    Settings.tsx
    useGame.ts               # hook wiring engine <-> UI
```

### Module responsibilities

- **words.ts** — loads `words.json`; queries by grade and length.
- **leitner.ts** — pure box transitions (`recordResult`), per-word difficulty
  stepping (up at box ≥ 4, down after 2 consecutive misses), and box-weighted
  selection helpers.
- **similarity.ts** — scores how "confusable" two words are, based on length
  match + shared starting sound + edit distance. Drives far→near decoy selection.
- **homophones.ts** — homophone groups among the word lists; the round builder
  uses it to keep homophones of the target off the screen.
- **roundBuilder.ts** — given the active word pool and profile progress, picks
  one target (never the previous round's target) + N−1 decoys at the target
  word's stored difficulty.
- **session.ts** — owns progression: which grade is active and the trickle logic
  for seeding next-grade words.
- **speech.ts** — voice selection, `speak(word)`, browser-quirk handling.
- **ProfileStore / LocalStorageProfileStore** — persistence behind an interface.
- **ui/** — React screens; `useGame.ts` orchestrates a round and mediates between
  the engine and the view.

## Data Model

```ts
// Static word data (shipped with the app)
interface Word {
  id: string;                 // slug/lowercased word
  text: string;               // "cat"
  grade: 'preK' | 'K' | '1' | '2' | '3';
  length: number;
  tags?: string[];            // reserved for future themed/phonics packs
}

// Persisted save blob (the whole thing behind ProfileStore)
interface SaveBlob {
  version: number;
  activeProfileId: string | null;
  profiles: Profile[];
}

interface Profile {
  id: string;
  name: string;
  avatar: string;             // emoji for now
  settings: {
    wrongAnswerMode: 'keepTrying' | 'oneAndDone';   // default: keepTrying
  };
  progress: {
    words: Record<string, WordState>;   // keyed by Word.id
    stats: {
      rounds: number;
      correctFirstTry: number;
    };
  };
}

interface WordState {
  box: 1 | 2 | 3 | 4 | 5;
  seen: number;
  correct: number;
  introduced: boolean;
  choiceCount: number;        // 3..5 — per-word difficulty: cards on screen
  decoyNearness: number;      // 0..0.8 — per-word difficulty: decoy confusability
  missStreak: number;         // consecutive misses; 2 in a row steps difficulty down
}
```

## Testing

- **Vitest** for the pure engine — `leitner`, `similarity`, `roundBuilder`,
  `session`, and the store. This is where TDD pays off:
  - Leitner transitions (correct → up, wrong → box 1, box clamping).
  - Per-word difficulty steps up at box ≥ 4 and down after 2 consecutive misses,
    with caps and floors respected.
  - Box-weighted selection favors low boxes.
  - Similarity scoring orders far vs. near decoys correctly.
  - Homophones of the target never appear as decoys.
  - Round builder returns exactly one correct target + valid decoys at the
    target word's stored difficulty, and never repeats the previous target.
  - Trickle logic seeds next-grade words only once the threshold is met.
  - Store round-trips a blob and namespaces profiles correctly.
- **React Testing Library** for component behavior: correct-tap and wrong-tap
  flows in both `keepTrying` and `oneAndDone` modes.

## Key Risks / Decisions

1. **TTS quality** depends on the device/browser. Accepted for the prototype
   (Chrome "Google US English" confirmed acceptable); isolated in `speech.ts`.
2. **`similarity.ts` scoring** is what makes decoys feel "gently harder." Based on
   length match + shared starting sound + edit distance; tunable.
3. **Storage abstraction** deliberately hides local-vs-server so the blob can move
   to a backend later with no changes to game logic.

## Future Layers (out of scope now, not precluded)

- Mode C (Spell It).
- Themed/phonics packs via `Word.tags`.
- Fry 1000 extended tail.
- Cloud accounts / server-backed `ProfileStore`.
- Cloud TTS.
