# Letter Jam

A lighthearted, touch-friendly web game that helps young children (roughly
ages 3–7) practice **letter recognition**, **word reading**, and
**letter-sound association**. A word is spoken aloud, a few word cards flip
onto the screen, and the child taps the one they hear. Correct taps get
confetti, floating emoji, and a happy chime; wrong taps gently fade and the
game says the wrong word before re-reading the prompt.

Difficulty adapts per child using a spaced-repetition engine, so the youngest
players win easily at first and the game quietly gets harder as they improve.

It runs entirely in the browser with no backend and no accounts — all progress
is stored locally.

## What it does

- **Listen & Find gameplay.** The target word is spoken inside a short context
  sentence — e.g. *"Dog. The dog ran to me. Dog."* — and the child taps the
  matching card among 3–5 choices.
- **Two modes, set per player** in Settings:
  - **Words** — 313 words from the classic [Dolch sight-word lists](https://en.wikipedia.org/wiki/Dolch_word_list)
    (220 graded service words + 93 nouns), grouped Pre-K → 3rd grade.
  - **Letters** — 52 entries (A–Z upper- and lowercase) for pre-readers,
    spoken as *"A. A is for apple. A."* Uppercase is learned first; lowercase
    trickles in as mastery grows.
- **Adaptive difficulty per word.** Each word tracks its own difficulty. Right
  answers make the distractors more confusable and add more cards; repeated
  misses ease it back off.
- **Spaced repetition.** A 5-box Leitner system resurfaces struggled-with words
  sooner and mastered words rarely. New words are introduced automatically as
  the child clears the ones they know.
- **Kind by design.** By default a round only ends on a correct answer (every
  round can end in celebration). An optional "stop after a wrong answer" mode
  is available for older kids.
- **Multiple local players.** A "Who's playing?" screen keeps each child's
  progress separate on the same device. A live stats bar shows streak,
  first-try wins, pool size, mastered count, and rounds played.

## How it works

The design keeps all game logic in **pure, framework-free TypeScript** under
`src/engine`, with React (`src/ui`) as a thin view layer. This makes the
interesting logic fully unit-testable without a DOM.

### The round loop

1. **Pick a target.** A word is chosen from the child's *introduced* pool,
   weighted toward low Leitner boxes so shakier words come up more often
   (`roundBuilder.ts`, `leitner.ts`). The previous round's word is never
   repeated immediately.
2. **Pick distractors.** Decoys are drawn from the *whole* dictionary and
   scored for visual confusability (`similarity.ts`). The word's own
   `decoyNearness` slides the selection from "wildly different" toward
   "easily confused." Guardrails guarantee the round is answerable and
   educational:
   - never a homophone of the target (`to`/`too`/`two`),
   - never two cases of the same letter together (`H`/`h`),
   - decoys are mutually distinct, and
   - at least one decoy shares the target's first letter, so a child can't
     win by first-letter alone.
3. **Speak & render.** The prompt is spoken via the browser's
   `SpeechSynthesis` (`speech.ts`), and the cards flip onto the screen at a
   uniform size.
4. **Score.** A first-try correct answer moves the word up a Leitner box; any
   wrong tap drops it two boxes (floor 1) and re-reads the prompt. Results feed
   back into per-word difficulty (`profiles.ts`).

### Spaced repetition & progression

- **Leitner boxes (1–5).** New words enter box 1. Correct-first-try → up one
  box (seen less often); a miss → down two (seen sooner). Selection is weighted
  heavily toward low boxes.
- **Per-word difficulty.** Each word stores its own `choiceCount` (3–5) and
  `decoyNearness` (0–0.8). Nearness rises on every correct answer; choice count
  grows as the word climbs into higher boxes; two misses in a row ease both.
- **Auto-introduction.** New words trickle in (a few at a time) as soon as the
  child has answered every already-introduced word at least once
  (`session.ts`). This flows Pre-K → 3rd grade in Words mode, and
  uppercase → lowercase in Letters mode.

### Data & content

- `scripts/build-words.mjs` assembles the dictionary (`src/data/words.json`)
  from the Dolch lists, the noun list, and the letter entries, then **fails the
  build** if any word's context sentence breaks the rules (missing, wrong
  format, not self-contained in the child-safe vocabulary, or the target sits
  at a sentence edge). This keeps every spoken sentence readable and built only
  from words a child could plausibly learn.
- Context sentences live in `scripts/sentences.mjs`.

### Storage

All state is a single JSON blob in `localStorage`, behind a `ProfileStore`
interface (`src/store`) so it can move to a server later without touching game
logic. Legacy saves are migrated on load by back-filling any newly added
fields.

### Touch, audio & mobile

Built to feel right on an iPad in a small child's hands:

- The app is a fixed, unscrollable viewport; pinch-zoom and rubber-band
  scrolling are disabled.
- Cards answer on `pointerdown` (a wiggly tap still registers) with large,
  uniform touch targets.
- Rounds auto-advance after a 3-second countdown; the correct tap stops the
  speech so the celebration chime isn't ducked by iOS's audio session.
- The celebration chime is synthesized with the Web Audio API and unlocked on
  the first tap (an iOS requirement).

## Tech stack

React 19 · Vite · TypeScript (strict) · Vitest + jsdom + React Testing Library
· `canvas-confetti`. No runtime dependencies beyond React and the confetti
library; audio and speech use built-in browser APIs.

## Getting started

```bash
npm install
npm run dev        # start the dev server (http://localhost:5173)
```

Open the URL, add a player, and go. To try Letters mode, open Settings (⚙️)
and toggle "Letter mode."

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with hot reload |
| `npm test` | Run the full test suite once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run build` | Type-check and build to `dist/` |
| `npm run build:words` | Regenerate `src/data/words.json` (runs the sentence validator) |
| `npm run preview` | Preview the production build locally |

### Deploying

`npm run build` produces a static `dist/` you can serve from any web server
(the app uses relative asset paths, so it works from a subdirectory too). The
profile screen shows a small build stamp (git SHA + build time) so you can
confirm which build is live after a deploy.

## Project structure

```
scripts/
  build-words.mjs      # generates words.json + validates sentences at build time
  sentences.mjs        # authored context sentence for every word
src/
  data/words.json      # generated dictionary (365 entries)
  engine/              # pure game logic (no React)
    types.ts             # shared domain types
    words.ts             # dictionary loader / mode filter
    leitner.ts           # Leitner boxes + per-word difficulty stepping
    session.ts           # word introduction / trickle progression
    similarity.ts        # visual confusability scoring (words + letters)
    homophones.ts        # homophone groups never shown together
    roundBuilder.ts      # assembles a round (target + distractors)
    profiles.ts          # profile helpers, apply a result
    speech.ts            # SpeechSynthesis wrapper + prompt formatting
    random.ts            # rng-injected weighted pick / shuffle
    id.ts                # id generation (secure-context safe)
  store/                 # ProfileStore interface + localStorage impl
  ui/                    # React components
    App.tsx, PlayScreen.tsx, ProfileSelect.tsx, Settings.tsx, Stats.tsx
    useGame.ts           # the round-loop hook wiring engine <-> view
    Feedback.tsx, sound.ts  # celebration visuals + chime
```

Nearly every engine module has a colocated `*.test.ts`; the suite runs ~90
tests covering the Leitner math, difficulty stepping, decoy selection
guarantees, the sentence validator, storage migration, and the play-screen
flows.

## Testing

```bash
npm test
```

The pure engine is exhaustively unit-tested; UI behavior (celebrations, taps,
auto-advance, mode switching) is covered with React Testing Library.

## Accessibility & audience notes

- Designed for touch first, with large targets and no time pressure — it is
  **not** a dexterity game.
- Uses the browser's default English voice (Chrome's "Google US English" reads
  best); quality varies by device and OS.
- Motion respects `prefers-reduced-motion`.

## License

No license is currently specified. The word lists are public-domain Dolch
lists; the context sentences and code are original to this project.
