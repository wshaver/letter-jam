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
- **Six adaptive fonts in both modes.** Andika, Nunito and Atkinson Hyperlegible
  (sans-serif), plus Lora, Libre Baskerville and Source Serif 4 (serif). All cards
  in a round share the same font, selected once using the target item's current
  difficulty. Font variation unlocks at difficulty 0, 0.2, 0.3, 0.5, 0.6 and 0.8;
  a new item starts with Andika and eight first-try successes unlock all six.
  Two consecutive misses reduce difficulty by 0.3, narrowing font variety too.
  Existing saves use their current difficulty without migration or reset. The
  font files are served locally and loaded before play; their licenses ship in
  `public/fonts/`. Card letter sizes are unchanged.
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
3. **Speak & render.** Approved recordings play through Howler sprites, with
   device `SpeechSynthesis` for missing audio and word context sentences.
   The cards flip onto the screen at a uniform size.
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

Progress has no app-defined expiry. The existing `letter-jam-save-v1` key is
preserved, and legacy saves still migrate on load. A second local key retains
the previous valid save for recovery if the primary save is missing or corrupt.
This second key does not protect against clearing all website data.

Selecting or creating a player requests persistent storage through
`navigator.storage.persist()`. The browser decides whether to grant it; denial
does not interrupt play. Failed saves show an error with backup instructions.

On iPad, use Safari → Share → Add to Home Screen, and launch Letter Jam from
that icon. The manifest opens a standalone Home Screen app. WebKit exempts
Home Screen apps from its ITP inactivity cap; normal Safari tabs may still
lose script-written data after inactivity. See
[WebKit tracking prevention](https://webkit.org/tracking-prevention/) and
[storage policy](https://webkit.org/blog/14403/updates-to-storage-policy/).
Neither this app nor persistent storage can prevent explicit website-data
clearing, private-session deletion, or loss of the device.

**Keep progress safe**, on the player screen and in Settings, provides a
downloadable JSON backup of all players and a validated restore. Back up
before moving into the Home Screen app: its storage may be separate from
Safari. Restore merges players by ID, retaining the profile with more completed
rounds; ties keep the current profile. Refresh the downloaded backup after
playing. Files saved outside the browser can recover progress after website
data is removed. There is no server backup, and previously deleted saves
cannot be reconstructed without a surviving copy.

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
· `canvas-confetti` · Howler. Celebration chimes use Web Audio; missing speech
uses the device's browser voice.

### Approved speech recordings

`src/data/audio.json` maps approved dopamine-learning-machine Studio takes to
five local MP3 sprite packs in `public/audio/` (about 3.6 MB total). Howler loads
each pack on demand and reuses it. The import includes 26 names, 26 complete
letter phrases, and 241 isolated words; 226 of Letter Jam's 313 words have a
recording. Missing words and context sentences keep device speech. Playback
failures also fall back to device speech. Letter names and sight words such as
“a” and “I” use separate recordings.

Letter hints use the approved take's wording, including “G is for goat” and
“X is for xylophone”, in both cases of the letter. The prompt still follows
name → phrase → name. Word prompts, answer sequencing, scoring and chimes
keep their existing behavior.

After approving and applying audio in the source Studio, refresh the snapshot:

```sh
npm run import:audio -- ../dopamine-learning-machine
npm run build
```

The importer checks availability, review status and the active approved take ID
before copying a clip. It copies published sprite files without re-encoding and
stores the approved take's text with phoneme markup removed. No private take
history or credentials are imported. Publish the rebuilt app to deliver updates.

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
    speech.ts            # Recorded/device speech queue + prompt formatting
    recordedAudio.ts     # Howler sprites and approved clip lookup
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

## Deploying

```sh
npm run publish:letterjam
```

`scripts/publish.py` publishes only to `https://willshaver.com/letterjam/`,
following dopamine-learning-machine's versioned SFTP release workflow. It runs
the tests and production build, verifies uploaded bytes, switches the live
symlink, and compares every public release file against its HTTPS response.
Verification failure restores the previous site. The first deployment preserves
the old directory; later releases retain previous versions and assets needed by
already-open tabs. No browser progress keys or server-side user data are changed.

One-time setup on another machine:

```sh
python -m pip install --target .deploy-tools paramiko==5.0.0
python scripts/publish.py --inspect
```

Before inspection, put SSH `host`, `username`, and `password` in the ignored
`.env.deploy.json` and the verified SSH host key in `.deploy/known_hosts`.
The current setup reuses the existing dopamine-learning-machine SSH credentials
and pinned host key; database and account credentials are not needed. Keep these
files private. Deployment records, including the previous release path, are
written to `.deploy/last-publish.json`. The publisher uploads only the built
static site and its generated cache configuration.

## Accessibility & audience notes

- Designed for touch first, with large targets and no time pressure — it is
  **not** a dexterity game.
- Uses approved recorded speech when available. Device speech prefers
  "Google US English" and otherwise an available English voice; fallback
  quality varies by device and OS.
- Motion respects `prefers-reduced-motion`.

## License

No license is currently specified. The word lists are public-domain Dolch
lists; the context sentences and code are original to this project.
