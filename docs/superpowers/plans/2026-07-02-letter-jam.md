# Letter Jam Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a lighthearted, touch-friendly web game where a child hears a spoken word and taps the matching written word among gently falling choices, with automatic difficulty ramp driven by a Leitner spaced-repetition engine.

**Architecture:** React + Vite + TypeScript single-page app. All game logic lives in pure, framework-free TypeScript modules under `src/engine` and `src/store`; React (`src/ui`) is only the view layer. Persistence is a single JSON blob behind a `ProfileStore` interface (localStorage now, server later).

**Tech Stack:** React 19, Vite 7, TypeScript 5 (strict), Vitest 3 + jsdom + React Testing Library, canvas-confetti, browser `SpeechSynthesis`.

## Global Constraints

- **TypeScript strict mode** on for all source.
- **No backend, no accounts.** All state persists locally as one JSON blob behind the `ProfileStore` interface.
- **Not a dexterity game.** No tap timers; motion is decorative only.
- **Leitner rules:** 5 boxes; new word enters box 1; correct-on-first-try → up one box (max 5); any wrong tap → box 1.
- **Per-word difficulty:** each word stores `choiceCount` (3–5, start 3), `decoyNearness` (0–0.8, start 0), and `missStreak` (start 0). Step UP (`choiceCount +1` cap 5, `nearness +0.4` cap 0.8) on a correct-first-try that lands the word in box ≥ 4. Step DOWN (`−1` / `−0.4`, floors 3 / 0) after 2 consecutive misses, which also resets the streak; a correct answer resets the streak too. A round's difficulty = the target word's stored difficulty.
- **Decoys must never be homophones of the target** (to/too/two, ate/eight, …) — a homophone decoy makes the round unanswerable.
- **The previous round's target is never the next round's target** (unless it is the only introduced word).
- **TTS carrier phrase:** words are spoken as `Find the word, <word>!` (exact format — tests parse it).
- **Wrong-answer default is `keepTrying`;** `oneAndDone` is opt-in per profile. A `oneAndDone` miss reveals the correct card (highlight) before "Next".
- **Celebration tiers:** first-try win → big (confetti + balloon + happy chime); recovered win (after a wrong tap) → small (minor confetti, no balloon, softer chime); miss → none.
- **Word data:** Dolch sight words grouped by grade, stored **lowercased**, generated into `src/data/words.json`.
- **All TTS concerns isolated in `src/engine/speech.ts`.**
- Test command targets a single file: `npx vitest run <path>`.

---

## File Structure

```
scripts/build-words.mjs        # generates src/data/words.json from Dolch lists
src/
  data/words.json              # generated word data (committed)
  engine/
    types.ts                   # shared domain types
    words.ts                   # load + query word data
    leitner.ts                 # pure box transitions + weighting
    similarity.ts              # word confusability scoring
    homophones.ts              # homophone groups (never co-shown in a round)
    random.ts                  # weightedPick + shuffle (rng injected)
    profiles.ts                # create/update profile + apply results
    session.ts                 # progression, trickle, difficulty
    roundBuilder.ts            # picks target + decoys for one round
    speech.ts                  # TTS wrapper + pickVoice
  store/
    ProfileStore.ts            # interface + EMPTY_BLOB
    LocalStorageProfileStore.ts
  ui/
    App.tsx                    # load/save blob, screen routing
    ProfileSelect.tsx          # "who's playing?" + add player
    PlayScreen.tsx             # the game screen
    Feedback.tsx               # confetti/balloons/chime
    Settings.tsx               # per-profile settings
    useGame.ts                 # hook wiring engine <-> UI
    sound.ts                   # WebAudio chime (guarded)
  test/setup.ts                # RTL jest-dom setup
  main.tsx, index.css
```

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `index.html`, `.gitignore`
- Create: `src/main.tsx`, `src/index.css`, `src/test/setup.ts`, `src/ui/App.tsx`
- Test: `src/smoke.test.tsx`

**Interfaces:**
- Produces: a runnable Vite app and a working Vitest+jsdom+RTL toolchain. `App` is a placeholder replaced in Task 12.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "letter-jam",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "build:words": "node scripts/build-words.mjs"
  },
  "dependencies": {
    "canvas-confetti": "^1.9.3",
    "react": "^19.1.0",
    "react-dom": "^19.1.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.3.0",
    "@testing-library/user-event": "^14.6.1",
    "@types/canvas-confetti": "^1.9.0",
    "@types/react": "^19.1.0",
    "@types/react-dom": "^19.1.0",
    "@vitejs/plugin-react": "^4.5.0",
    "jsdom": "^26.1.0",
    "typescript": "^5.8.3",
    "vite": "^7.0.0",
    "vitest": "^3.2.0"
  }
}
```

- [ ] **Step 2: Create config files**

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src", "vite.config.ts"]
}
```

`tsconfig.node.json`:
```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

`vite.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
});
```

`.gitignore`:
```
node_modules
dist
*.local
```

`index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <title>Letter Jam</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 3: Create source entry + placeholder files**

`src/test/setup.ts`:
```ts
import '@testing-library/jest-dom';
```

`src/index.css`:
```css
* { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, sans-serif; }
```

`src/ui/App.tsx`:
```tsx
export function App() {
  return <div>Letter Jam</div>;
}
```

`src/main.tsx`:
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 4: Write the smoke test**

`src/smoke.test.tsx` (`.tsx` — it contains JSX):
```ts
import { render, screen } from '@testing-library/react';
import { App } from './ui/App';

it('renders the app shell', () => {
  render(<App />);
  expect(screen.getByText('Letter Jam')).toBeInTheDocument();
});
```

- [ ] **Step 5: Install and run**

Run: `npm install`
Then: `npx vitest run src/smoke.test.tsx`
Expected: PASS (1 test)
Then: `npm run build`
Expected: build succeeds, `dist/` produced.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite + React + TS + Vitest"
```

---

### Task 2: Shared types + Dolch word data + loader

**Files:**
- Create: `src/engine/types.ts`, `scripts/build-words.mjs`, `src/data/words.json` (generated), `src/engine/words.ts`
- Test: `src/engine/words.test.ts`

**Interfaces:**
- Produces:
  - `Grade = 'preK'|'K'|'1'|'2'|'3'`
  - `Word { id: string; text: string; grade: Grade; length: number; tags?: string[] }`
  - `Box = 1|2|3|4|5`
  - `WordState { box: Box; seen: number; correct: number; introduced: boolean; choiceCount: number; decoyNearness: number; missStreak: number }`
  - `ProfileSettings { wrongAnswerMode: 'keepTrying'|'oneAndDone' }`
  - `ProfileStats { rounds: number; correctFirstTry: number }`
  - `Profile { id; name; avatar; settings: ProfileSettings; progress: { words: Record<string, WordState>; stats: ProfileStats } }`
  - `SaveBlob { version: number; activeProfileId: string|null; profiles: Profile[] }`
  - `Difficulty { choiceCount: number; decoyNearness: number }`
  - `Round { target: Word; choices: Word[] }`
  - `allWords(): Word[]`, `wordsByGrade(grade: Grade): Word[]`, `wordById(id: string): Word | undefined`

- [ ] **Step 1: Create `src/engine/types.ts`**

```ts
export type Grade = 'preK' | 'K' | '1' | '2' | '3';

export interface Word {
  id: string;
  text: string;
  grade: Grade;
  length: number;
  tags?: string[];
}

export type Box = 1 | 2 | 3 | 4 | 5;

export interface WordState {
  box: Box;
  seen: number;
  correct: number;
  introduced: boolean;
  choiceCount: number; // 3..5 — per-word difficulty: cards on screen
  decoyNearness: number; // 0..0.8 — per-word difficulty: decoy confusability
  missStreak: number; // consecutive misses; 2 in a row steps difficulty down
}

export interface ProfileSettings {
  wrongAnswerMode: 'keepTrying' | 'oneAndDone';
}

export interface ProfileStats {
  rounds: number;
  correctFirstTry: number;
}

export interface Profile {
  id: string;
  name: string;
  avatar: string;
  settings: ProfileSettings;
  progress: {
    words: Record<string, WordState>;
    stats: ProfileStats;
  };
}

export interface SaveBlob {
  version: number;
  activeProfileId: string | null;
  profiles: Profile[];
}

export interface Difficulty {
  choiceCount: number;
  decoyNearness: number; // 0 = pick far/different decoys, 1 = pick near/confusable decoys
}

export interface Round {
  target: Word;
  choices: Word[]; // includes target, shuffled
}
```

- [ ] **Step 2: Create `scripts/build-words.mjs`** (Dolch service words by grade, lowercased)

```js
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DOLCH = {
  preK: ['a','and','away','big','blue','can','come','down','find','for','funny','go','help','here','i','in','is','it','jump','little','look','make','me','my','not','one','play','red','run','said','see','the','three','to','two','up','we','where','yellow','you'],
  K: ['all','am','are','at','ate','be','black','brown','but','came','did','do','eat','four','get','good','have','he','into','like','must','new','no','now','on','our','out','please','pretty','ran','ride','saw','say','she','so','soon','that','there','they','this','too','under','want','was','well','went','what','white','who','will','with','yes'],
  '1': ['after','again','an','any','as','ask','by','could','every','fly','from','give','going','had','has','her','him','his','how','just','know','let','live','may','of','old','once','open','over','put','round','some','stop','take','thank','them','then','think','walk','were','when'],
  '2': ['always','around','because','been','before','best','both','buy','call','cold','does','dont','fast','first','five','found','gave','goes','green','its','made','many','off','or','pull','read','right','sing','sit','sleep','tell','their','these','those','upon','us','use','very','wash','which','why','wish','work','would','write','your'],
  '3': ['about','better','bring','carry','clean','cut','done','draw','drink','eight','fall','far','full','got','grow','hold','hot','hurt','if','keep','kind','laugh','light','long','much','myself','never','only','own','pick','seven','shall','show','six','small','start','ten','today','together','try','warm'],
};

const words = [];
for (const [grade, list] of Object.entries(DOLCH)) {
  for (const text of list) {
    words.push({ id: text, text, grade, length: text.length });
  }
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = `${__dirname}/../src/data/words.json`;
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(words, null, 2) + '\n');
console.log(`Wrote ${words.length} words to ${outPath}`);
```

- [ ] **Step 3: Generate the data**

Run: `npm run build:words`
Expected: `Wrote 219 words to .../src/data/words.json` and the file exists.

- [ ] **Step 4: Create `src/engine/words.ts`**

```ts
import raw from '../data/words.json';
import type { Grade, Word } from './types';

const words = raw as Word[];

export function allWords(): Word[] {
  return words;
}

export function wordsByGrade(grade: Grade): Word[] {
  return words.filter((w) => w.grade === grade);
}

export function wordById(id: string): Word | undefined {
  return words.find((w) => w.id === id);
}
```

- [ ] **Step 5: Write the failing test**

`src/engine/words.test.ts`:
```ts
import { allWords, wordsByGrade, wordById } from './words';

it('loads a substantial word list', () => {
  expect(allWords().length).toBeGreaterThanOrEqual(200);
});

it('groups known words by grade', () => {
  const preK = wordsByGrade('preK').map((w) => w.text);
  expect(preK).toContain('the');
  expect(preK).toContain('look');
});

it('looks up a word by id with computed length', () => {
  const w = wordById('the');
  expect(w?.grade).toBe('preK');
  expect(w?.length).toBe(3);
});
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run src/engine/words.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add domain types, Dolch word data, and word loader"
```

---

### Task 3: Leitner engine

**Files:**
- Create: `src/engine/leitner.ts`
- Test: `src/engine/leitner.test.ts`

**Interfaces:**
- Consumes: `WordState`, `Box` from `./types`.
- Produces:
  - `NUM_BOXES = 5`, `MIN_CHOICES = 3`, `MAX_CHOICES = 5`, `NEARNESS_STEP = 0.4`, `MAX_NEARNESS = 0.8`, `HARDER_BOX = 4`, `MISSES_TO_EASE = 2`
  - `newWordState(): WordState` (box 1, introduced true, seen/correct 0, choiceCount 3, decoyNearness 0, missStreak 0)
  - `recordResult(state: WordState, correctFirstTry: boolean): WordState` (box transitions + per-word difficulty stepping)
  - `boxWeight(box: Box): number` (box 1 heaviest)

- [ ] **Step 1: Write the failing test**

`src/engine/leitner.test.ts`:
```ts
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

it('any wrong tap drops back to box 1', () => {
  let s = { ...newWordState(), box: 4 as const, seen: 3, correct: 3 };
  s = recordResult(s, false);
  expect(s.box).toBe(1);
  expect(s.seen).toBe(4);
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
  let s = { ...newWordState(), box: 5 as const, choiceCount: 5, decoyNearness: 0.8 };
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/engine/leitner.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/engine/leitner.ts`**

```ts
import type { Box, WordState } from './types';

export const NUM_BOXES = 5;
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
    box: 1,
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/engine/leitner.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add Leitner box engine with per-word difficulty"
```

---

### Task 4: Word similarity + homophones

**Files:**
- Create: `src/engine/similarity.ts`, `src/engine/homophones.ts`
- Test: `src/engine/similarity.test.ts`, `src/engine/homophones.test.ts`

**Interfaces:**
- Produces:
  - `levenshtein(a: string, b: string): number`
  - `similarity(a: string, b: string): number` — returns `[0,1]`, higher = more confusable (based on edit distance + length match + shared first letter).
  - `areHomophones(a: string, b: string): boolean` — true when two *different* words sound alike (to/too/two, ate/eight, …).

- [ ] **Step 1: Write the failing test**

`src/engine/similarity.test.ts`:
```ts
import { levenshtein, similarity } from './similarity';

it('computes edit distance', () => {
  expect(levenshtein('cat', 'cot')).toBe(1);
  expect(levenshtein('cat', 'cat')).toBe(0);
  expect(levenshtein('cat', 'dog')).toBe(3);
});

it('rates confusable words higher than very different words', () => {
  expect(similarity('cat', 'cot')).toBeGreaterThan(similarity('cat', 'banana'));
  expect(similarity('cat', 'can')).toBeGreaterThan(similarity('cat', 'house'));
});

it('returns 1 for identical words', () => {
  expect(similarity('cat', 'cat')).toBe(1);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/engine/similarity.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/engine/similarity.ts`**

```ts
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[] = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return dp[n];
}

export function similarity(a: string, b: string): number {
  const s1 = a.toLowerCase();
  const s2 = b.toLowerCase();
  if (s1 === s2) return 1;
  const maxLen = Math.max(s1.length, s2.length) || 1;
  const editScore = 1 - levenshtein(s1, s2) / maxLen;
  const lengthScore = 1 - Math.abs(s1.length - s2.length) / maxLen;
  const startScore = s1[0] === s2[0] ? 1 : 0;
  return 0.5 * editScore + 0.3 * lengthScore + 0.2 * startScore;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/engine/similarity.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Write the failing homophones test**

`src/engine/homophones.test.ts`:
```ts
import { areHomophones } from './homophones';

it('detects homophones across a group', () => {
  expect(areHomophones('to', 'two')).toBe(true);
  expect(areHomophones('too', 'to')).toBe(true);
  expect(areHomophones('ate', 'eight')).toBe(true);
  expect(areHomophones('there', 'their')).toBe(true);
});

it('a word is not its own homophone', () => {
  expect(areHomophones('to', 'to')).toBe(false);
});

it('unrelated words are not homophones', () => {
  expect(areHomophones('cat', 'dog')).toBe(false);
  expect(areHomophones('for', 'from')).toBe(false);
});
```

Run: `npx vitest run src/engine/homophones.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 6: Implement `src/engine/homophones.ts`**

```ts
// Homophone groups among (and near) the Dolch lists. Words in the same group
// sound alike, so a spoken target could match either spelling — they must
// never appear together in one round.
const HOMOPHONE_GROUPS: string[][] = [
  ['to', 'too', 'two'],
  ['there', 'their'],
  ['for', 'four'],
  ['no', 'know'],
  ['by', 'buy'],
  ['right', 'write'],
  ['ate', 'eight'],
  ['one', 'won'],
  ['red', 'read'], // "read" (past tense) sounds like "red"
  ['blue', 'blew'],
  ['new', 'knew'],
  ['be', 'bee'],
  ['see', 'sea'],
  ['our', 'hour'],
];

export function areHomophones(a: string, b: string): boolean {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  if (x === y) return false;
  return HOMOPHONE_GROUPS.some((g) => g.includes(x) && g.includes(y));
}
```

- [ ] **Step 7: Run to verify it passes**

Run: `npx vitest run src/engine/homophones.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add word similarity scoring and homophone groups"
```

---

### Task 5: Random utilities

**Files:**
- Create: `src/engine/random.ts`
- Test: `src/engine/random.test.ts`

**Interfaces:**
- Produces:
  - `type Rng = () => number`
  - `weightedPick<T>(items: T[], weightOf: (t: T) => number, rng: Rng): T`
  - `shuffle<T>(items: T[], rng: Rng): T[]` (returns a new array, does not mutate)

- [ ] **Step 1: Write the failing test**

`src/engine/random.test.ts`:
```ts
import { weightedPick, shuffle, type Rng } from './random';

// Deterministic RNG helper
function seeded(seed: number): Rng {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

it('weightedPick returns the sole item', () => {
  expect(weightedPick(['x'], () => 1, seeded(1))).toBe('x');
});

it('weightedPick favors heavier items over many draws', () => {
  const rng = seeded(42);
  const counts = { a: 0, b: 0 };
  for (let i = 0; i < 1000; i++) {
    const pick = weightedPick(['a', 'b'], (x) => (x === 'a' ? 9 : 1), rng);
    counts[pick as 'a' | 'b']++;
  }
  expect(counts.a).toBeGreaterThan(counts.b * 3);
});

it('shuffle preserves all elements without mutating input', () => {
  const input = [1, 2, 3, 4, 5];
  const out = shuffle(input, seeded(7));
  expect(out).toHaveLength(5);
  expect([...out].sort()).toEqual([1, 2, 3, 4, 5]);
  expect(input).toEqual([1, 2, 3, 4, 5]);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/engine/random.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/engine/random.ts`**

```ts
export type Rng = () => number;

export function weightedPick<T>(items: T[], weightOf: (t: T) => number, rng: Rng): T {
  if (items.length === 0) throw new Error('weightedPick on empty array');
  const total = items.reduce((sum, it) => sum + weightOf(it), 0);
  let r = rng() * total;
  for (const it of items) {
    r -= weightOf(it);
    if (r < 0) return it;
  }
  return items[items.length - 1];
}

export function shuffle<T>(items: T[], rng: Rng): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/engine/random.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add rng-injected weightedPick and shuffle"
```

---

### Task 6: Profiles + storage

**Files:**
- Create: `src/engine/profiles.ts`, `src/store/ProfileStore.ts`, `src/store/LocalStorageProfileStore.ts`
- Test: `src/engine/profiles.test.ts`, `src/store/LocalStorageProfileStore.test.ts`

**Interfaces:**
- Consumes: `newWordState`, `recordResult` from `../engine/leitner`.
- Produces:
  - `createProfile(id: string, name: string, avatar: string): Profile`
  - `upsertProfile(blob: SaveBlob, profile: Profile): SaveBlob`
  - `applyResult(profile: Profile, wordId: string, correctFirstTry: boolean): Profile`
  - `interface ProfileStore { load(): Promise<SaveBlob>; save(blob: SaveBlob): Promise<void> }`
  - `EMPTY_BLOB: SaveBlob` (`version: 1`, `activeProfileId: null`, `profiles: []`)
  - `class LocalStorageProfileStore implements ProfileStore`

- [ ] **Step 1: Write the failing test for profiles**

`src/engine/profiles.test.ts`:
```ts
import { createProfile, upsertProfile, applyResult } from './profiles';
import type { SaveBlob } from './types';

it('creates a profile with keepTrying default and empty progress', () => {
  const p = createProfile('id1', 'Ada', '🦄');
  expect(p.settings.wrongAnswerMode).toBe('keepTrying');
  expect(p.progress.words).toEqual({});
  expect(p.progress.stats).toEqual({ rounds: 0, correctFirstTry: 0 });
});

it('upsertProfile adds then replaces in place, preserving order', () => {
  const blob: SaveBlob = { version: 1, activeProfileId: null, profiles: [] };
  const a = createProfile('a', 'Ada', '🦄');
  const b = createProfile('b', 'Bo', '🐯');
  let b2 = upsertProfile(upsertProfile(blob, a), b);
  b2 = upsertProfile(b2, { ...a, name: 'Ada B' });
  expect(b2.profiles.map((p) => p.id)).toEqual(['a', 'b']); // order preserved
  expect(b2.profiles[0].name).toBe('Ada B');
});

it('applyResult moves a word up on first-try correct and records stats', () => {
  const p = createProfile('id1', 'Ada', '🦄');
  const p1 = applyResult(p, 'the', true);
  expect(p1.progress.words['the'].box).toBe(2);
  expect(p1.progress.stats).toEqual({ rounds: 1, correctFirstTry: 1 });
  const p2 = applyResult(p1, 'the', false);
  expect(p2.progress.words['the'].box).toBe(1);
  expect(p2.progress.stats.correctFirstTry).toBe(1);
});
```

- [ ] **Step 2: Implement `src/engine/profiles.ts`**

```ts
import type { Profile, SaveBlob } from './types';
import { newWordState, recordResult } from './leitner';

export function createProfile(id: string, name: string, avatar: string): Profile {
  return {
    id,
    name,
    avatar,
    settings: { wrongAnswerMode: 'keepTrying' },
    progress: { words: {}, stats: { rounds: 0, correctFirstTry: 0 } },
  };
}

export function upsertProfile(blob: SaveBlob, profile: Profile): SaveBlob {
  // Replace in place so the profile list keeps a stable order in the UI.
  const i = blob.profiles.findIndex((p) => p.id === profile.id);
  const profiles =
    i === -1 ? [...blob.profiles, profile] : blob.profiles.map((p, j) => (j === i ? profile : p));
  return { ...blob, profiles };
}

export function applyResult(profile: Profile, wordId: string, correctFirstTry: boolean): Profile {
  const prev = profile.progress.words[wordId] ?? newWordState();
  const next = recordResult(prev, correctFirstTry);
  return {
    ...profile,
    progress: {
      words: { ...profile.progress.words, [wordId]: next },
      stats: {
        rounds: profile.progress.stats.rounds + 1,
        correctFirstTry: profile.progress.stats.correctFirstTry + (correctFirstTry ? 1 : 0),
      },
    },
  };
}
```

- [ ] **Step 3: Run profiles test**

Run: `npx vitest run src/engine/profiles.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 4: Write the failing test for the store**

`src/store/LocalStorageProfileStore.test.ts`:
```ts
import { LocalStorageProfileStore } from './LocalStorageProfileStore';
import { EMPTY_BLOB } from './ProfileStore';

beforeEach(() => localStorage.clear());

it('returns an empty blob when nothing is stored', async () => {
  const store = new LocalStorageProfileStore();
  expect(await store.load()).toEqual(EMPTY_BLOB);
});

it('round-trips a saved blob', async () => {
  const store = new LocalStorageProfileStore();
  const blob = { version: 1, activeProfileId: 'x', profiles: [] };
  await store.save(blob);
  expect(await store.load()).toEqual(blob);
});

it('recovers to empty blob on corrupt data', async () => {
  localStorage.setItem('letter-jam-save-v1', '{not json');
  const store = new LocalStorageProfileStore();
  expect(await store.load()).toEqual(EMPTY_BLOB);
});
```

- [ ] **Step 5: Implement the store**

`src/store/ProfileStore.ts`:
```ts
import type { SaveBlob } from '../engine/types';

export interface ProfileStore {
  load(): Promise<SaveBlob>;
  save(blob: SaveBlob): Promise<void>;
}

export const EMPTY_BLOB: SaveBlob = {
  version: 1,
  activeProfileId: null,
  profiles: [],
};
```

`src/store/LocalStorageProfileStore.ts`:
```ts
import type { SaveBlob } from '../engine/types';
import { EMPTY_BLOB, type ProfileStore } from './ProfileStore';

const KEY = 'letter-jam-save-v1';

export class LocalStorageProfileStore implements ProfileStore {
  async load(): Promise<SaveBlob> {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(EMPTY_BLOB);
    try {
      return JSON.parse(raw) as SaveBlob;
    } catch {
      return structuredClone(EMPTY_BLOB);
    }
  }

  async save(blob: SaveBlob): Promise<void> {
    localStorage.setItem(KEY, JSON.stringify(blob));
  }
}
```

- [ ] **Step 6: Run store test**

Run: `npx vitest run src/store/LocalStorageProfileStore.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add profile helpers and localStorage-backed ProfileStore"
```

---

### Task 7: Session progression & trickle

**Files:**
- Create: `src/engine/session.ts`
- Test: `src/engine/session.test.ts`

**Interfaces:**
- Consumes: `newWordState` from `./leitner`; `Word`, `Grade`, `Profile`, `Box` from `./types`.
- Produces:
  - `GRADES: Grade[]` (order preK→3)
  - `SessionConfig { initialBatch; trickleBatch; trickleThreshold; masteredBox: Box }`
  - `DEFAULT_SESSION_CONFIG: SessionConfig` (`initialBatch: 6, trickleBatch: 3, trickleThreshold: 0.6, masteredBox: 4`)
  - `orderedWords(words: Word[]): Word[]` (grade order, then length asc, then alpha)
  - `introduceIfNeeded(profile: Profile, words: Word[], config?: SessionConfig): Profile`
  - Note: round difficulty is per-word (stored in `WordState`, stepped by `leitner.recordResult`) — session has no difficulty logic.

- [ ] **Step 1: Write the failing test**

`src/engine/session.test.ts`:
```ts
import { orderedWords, introduceIfNeeded, DEFAULT_SESSION_CONFIG } from './session';
import { createProfile } from './profiles';
import type { Word } from './types';

const W = (id: string, grade: Word['grade'], length: number): Word => ({ id, text: id, grade, length });

const WORDS: Word[] = [
  W('go', 'preK', 2), W('the', 'preK', 3), W('look', 'preK', 4),
  W('see', 'preK', 3), W('big', 'preK', 3), W('down', 'preK', 4),
  W('play', 'preK', 4), W('came', 'K', 4), W('black', 'K', 5),
];

it('orders words by grade, then length, then alpha', () => {
  const first = orderedWords(WORDS)[0];
  expect(first.grade).toBe('preK');
  expect(first.length).toBe(2); // "go"
});

it('introduces the initial batch when nothing is introduced', () => {
  const p = introduceIfNeeded(createProfile('id', 'A', '🦄'), WORDS);
  const introduced = Object.values(p.progress.words).filter((s) => s.introduced);
  expect(introduced).toHaveLength(DEFAULT_SESSION_CONFIG.initialBatch);
});

it('does not introduce more until the mastery threshold is met', () => {
  const p0 = introduceIfNeeded(createProfile('id', 'A', '🦄'), WORDS);
  const before = Object.keys(p0.progress.words).length;
  const p1 = introduceIfNeeded(p0, WORDS); // still box 1, no mastery
  expect(Object.keys(p1.progress.words).length).toBe(before);
});

it('trickles in more words once enough are mastered', () => {
  let p = introduceIfNeeded(createProfile('id', 'A', '🦄'), WORDS);
  // Force all introduced words to a mastered box.
  for (const id of Object.keys(p.progress.words)) p.progress.words[id].box = 5;
  const before = Object.keys(p.progress.words).length;
  p = introduceIfNeeded(p, WORDS);
  expect(Object.keys(p.progress.words).length).toBeGreaterThan(before);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/engine/session.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/engine/session.ts`**

```ts
import type { Box, Grade, Profile, Word } from './types';
import { newWordState } from './leitner';

export const GRADES: Grade[] = ['preK', 'K', '1', '2', '3'];

export interface SessionConfig {
  initialBatch: number;
  trickleBatch: number;
  trickleThreshold: number;
  masteredBox: Box;
}

export const DEFAULT_SESSION_CONFIG: SessionConfig = {
  initialBatch: 6,
  trickleBatch: 3,
  trickleThreshold: 0.6,
  masteredBox: 4,
};

export function orderedWords(words: Word[]): Word[] {
  const gi = (g: Grade) => GRADES.indexOf(g);
  return [...words].sort(
    (a, b) => gi(a.grade) - gi(b.grade) || a.length - b.length || a.text.localeCompare(b.text),
  );
}

export function introduceIfNeeded(
  profile: Profile,
  words: Word[],
  config: SessionConfig = DEFAULT_SESSION_CONFIG,
): Profile {
  const state = profile.progress.words;
  const introducedIds = Object.keys(state).filter((id) => state[id].introduced);
  const ordered = orderedWords(words);

  let toIntroduce: Word[] = [];
  if (introducedIds.length === 0) {
    toIntroduce = ordered.slice(0, config.initialBatch);
  } else {
    const mastered = introducedIds.filter((id) => state[id].box >= config.masteredBox).length;
    if (mastered / introducedIds.length >= config.trickleThreshold) {
      toIntroduce = ordered.filter((w) => !state[w.id]?.introduced).slice(0, config.trickleBatch);
    }
  }

  if (toIntroduce.length === 0) return profile;

  const words2 = { ...state };
  for (const w of toIntroduce) words2[w.id] = newWordState();
  return { ...profile, progress: { ...profile.progress, words: words2 } };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/engine/session.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add session progression and grade trickle"
```

---

### Task 8: Round builder

**Files:**
- Create: `src/engine/roundBuilder.ts`
- Test: `src/engine/roundBuilder.test.ts`

**Interfaces:**
- Consumes: `boxWeight` from `./leitner`; `weightedPick`, `shuffle`, `Rng` from `./random`; `similarity` from `./similarity`; `areHomophones` from `./homophones`; `Word`, `Profile`, `Difficulty`, `Round` from `./types`.
- Produces:
  - `activePool(profile: Profile, words: Word[]): Word[]`
  - `pickDecoys(target: Word, words: Word[], difficulty: Difficulty, rng: Rng): Word[]` (never homophones of the target)
  - `buildRound(profile: Profile, words: Word[], rng: Rng, previousTargetId?: string): Round` — difficulty comes from the **target word's** stored `choiceCount`/`decoyNearness`; the previous target is excluded unless it is the only introduced word.

- [ ] **Step 1: Write the failing test**

`src/engine/roundBuilder.test.ts`:
```ts
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

const W = (id: string): Word => ({ id, text: id, grade: 'preK', length: id.length });
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/engine/roundBuilder.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/engine/roundBuilder.ts`**

```ts
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
    // A homophone decoy would make the spoken target ambiguous — never show one.
    .filter((w) => w.id !== target.id && !areHomophones(target.text, w.text))
    .map((w) => ({ w, s: similarity(target.text, w.text) }))
    .sort((a, b) => a.s - b.s); // ascending: least similar first
  const n = scored.length;
  if (n <= count) return scored.map((x) => x.w);

  const center = Math.round(difficulty.decoyNearness * (n - 1));
  const windowSize = Math.min(n, Math.max(count * 3, count + 2));
  const start = Math.max(0, Math.min(center - Math.floor(windowSize / 2), n - windowSize));
  const window = scored.slice(start, start + windowSize).map((x) => x.w);
  return shuffle(window, rng).slice(0, count);
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/engine/roundBuilder.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add round builder with per-word difficulty and homophone guard"
```

---

### Task 9: Speech (TTS)

**Files:**
- Create: `src/engine/speech.ts`
- Test: `src/engine/speech.test.ts`

**Interfaces:**
- Produces:
  - `interface Speaker { speak(text: string): void; cancel(): void }`
  - `pickVoice(voices: SpeechSynthesisVoice[], preferredName: string): SpeechSynthesisVoice | null`
  - `wordPrompt(word: string): string` — returns `` `Find the word, ${word}!` `` (exact format; UI tests parse it)
  - `createSpeaker(preferredName?: string): Speaker` (defaults to `'Google US English'`; no-op Speaker when `speechSynthesis` is unavailable)

- [ ] **Step 1: Write the failing test** (only the pure `pickVoice` is unit-tested)

`src/engine/speech.test.ts`:
```ts
import { pickVoice } from './speech';

const v = (name: string, lang: string) => ({ name, lang }) as SpeechSynthesisVoice;

it('prefers the exact named voice', () => {
  const voices = [v('Alex', 'en-US'), v('Google US English', 'en-US')];
  expect(pickVoice(voices, 'Google US English')?.name).toBe('Google US English');
});

it('falls back to any English voice', () => {
  const voices = [v('Klara', 'de-DE'), v('Daniel', 'en-GB')];
  expect(pickVoice(voices, 'Google US English')?.lang).toBe('en-GB');
});

it('returns null when there are no voices', () => {
  expect(pickVoice([], 'Google US English')).toBeNull();
});

it('wraps the word in the carrier phrase', () => {
  expect(wordPrompt('cat')).toBe('Find the word, cat!');
});
```

(The test file imports both: `import { pickVoice, wordPrompt } from './speech';`)

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/engine/speech.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/engine/speech.ts`**

```ts
export interface Speaker {
  speak(text: string): void;
  cancel(): void;
}

// Spoken carrier phrase. Isolated function words ("a", "the") are frequently
// mispronounced by TTS on their own; the phrase also cues the child.
export function wordPrompt(word: string): string {
  return `Find the word, ${word}!`;
}

export function pickVoice(
  voices: SpeechSynthesisVoice[],
  preferredName: string,
): SpeechSynthesisVoice | null {
  if (voices.length === 0) return null;
  const exact = voices.find((v) => v.name === preferredName);
  if (exact) return exact;
  const en = voices.find((v) => v.lang.toLowerCase().startsWith('en'));
  return en ?? voices[0];
}

export function createSpeaker(preferredName = 'Google US English'): Speaker {
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
  // Environments without SpeechSynthesis (e.g. jsdom, older browsers) get a no-op.
  if (!synth) {
    return { speak() {}, cancel() {} };
  }
  let voice: SpeechSynthesisVoice | null = null;
  const refresh = () => {
    voice = pickVoice(synth.getVoices(), preferredName);
  };
  refresh();
  if (typeof synth.addEventListener === 'function') {
    synth.addEventListener('voiceschanged', refresh);
  }
  return {
    speak(text: string) {
      synth.cancel();
      if (!voice) refresh();
      const u = new SpeechSynthesisUtterance(text);
      if (voice) u.voice = voice;
      u.rate = 0.9;
      synth.speak(u);
    },
    cancel() {
      synth.cancel();
    },
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/engine/speech.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add SpeechSynthesis wrapper with voice selection and carrier phrase"
```

---

### Task 10: Play experience (useGame + Feedback + PlayScreen)

**Files:**
- Create: `src/ui/useGame.ts`, `src/ui/sound.ts`, `src/ui/Feedback.tsx`, `src/ui/PlayScreen.tsx`
- Append styles: `src/index.css`
- Test: `src/ui/PlayScreen.test.tsx`

**Interfaces:**
- Consumes: `introduceIfNeeded` from `../engine/session`; `buildRound` from `../engine/roundBuilder`; `applyResult` from `../engine/profiles`; `Speaker`, `wordPrompt` from `../engine/speech`; `Rng` from `../engine/random`; `Profile`, `Word`, `Round` from `../engine/types`.
- Produces:
  - `useGame(opts: { profile: Profile; onProfileChange: (p: Profile) => void; words: Word[]; speaker: Speaker; rng?: Rng }): { round: Round | null; status: 'playing'|'won'|'missed'; celebration: 'big'|'small'|null; wrongIds: Set<string>; choose: (w: Word) => void; replay: () => void; next: () => void }`
  - `PlayScreen(props: { profile: Profile; onProfileChange: (p: Profile) => void; words: Word[]; speaker: Speaker; rng?: Rng }): JSX.Element`
  - `Feedback(props: { level: 'big'|'small' }): JSX.Element`
  - `playChime(level: 'big'|'small'): void`

- [ ] **Step 1: Implement `src/ui/sound.ts`** (guarded WebAudio chime)

```ts
export function playChime(level: 'big' | 'small'): void {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const notes = level === 'big' ? [523, 659, 784] : [523, 659];
    notes.forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      o.connect(g);
      g.connect(ctx.destination);
      const t = ctx.currentTime + i * 0.12;
      g.gain.setValueAtTime(0.001, t);
      g.gain.exponentialRampToValueAtTime(0.2, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      o.start(t);
      o.stop(t + 0.16);
    });
  } catch {
    // audio not available in this environment
  }
}
```

- [ ] **Step 2: Implement `src/ui/useGame.ts`**

```ts
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Profile, Round, Word } from '../engine/types';
import type { Rng } from '../engine/random';
import { wordPrompt, type Speaker } from '../engine/speech';
import { introduceIfNeeded } from '../engine/session';
import { buildRound } from '../engine/roundBuilder';
import { applyResult } from '../engine/profiles';

interface UseGameOpts {
  profile: Profile;
  onProfileChange: (p: Profile) => void;
  words: Word[];
  speaker: Speaker;
  rng?: Rng;
}

export function useGame(opts: UseGameOpts) {
  const { words, speaker, onProfileChange } = opts;
  const rng = opts.rng ?? Math.random;
  const profileRef = useRef(opts.profile);
  profileRef.current = opts.profile;

  const [round, setRound] = useState<Round | null>(null);
  const [status, setStatus] = useState<'playing' | 'won' | 'missed'>('playing');
  const [celebration, setCelebration] = useState<'big' | 'small' | null>(null);
  const [wrongIds, setWrongIds] = useState<Set<string>>(new Set());
  const hadWrong = useRef(false);
  const lastTargetId = useRef<string | null>(null);

  const startRound = useCallback(() => {
    const introduced = introduceIfNeeded(profileRef.current, words);
    if (introduced !== profileRef.current) {
      profileRef.current = introduced;
      onProfileChange(introduced);
    }
    const r = buildRound(introduced, words, rng, lastTargetId.current ?? undefined);
    lastTargetId.current = r.target.id;
    setRound(r);
    setWrongIds(new Set());
    hadWrong.current = false;
    setCelebration(null);
    setStatus('playing');
    speaker.speak(wordPrompt(r.target.text));
  }, [words, speaker, onProfileChange, rng]);

  const started = useRef(false);
  useEffect(() => {
    // Guard so StrictMode's double-invoked effect starts exactly one round
    // (and speaks exactly once); subsequent rounds come from next().
    if (started.current) return;
    started.current = true;
    startRound();
  }, [startRound]);

  const choose = (word: Word) => {
    if (status !== 'playing' || !round) return;
    if (word.id === round.target.id) {
      const firstTry = !hadWrong.current;
      onProfileChange(applyResult(profileRef.current, round.target.id, firstTry));
      setCelebration(firstTry ? 'big' : 'small');
      setStatus('won');
    } else {
      hadWrong.current = true;
      setWrongIds((prev) => new Set(prev).add(word.id));
      if (profileRef.current.settings.wrongAnswerMode === 'oneAndDone') {
        onProfileChange(applyResult(profileRef.current, round.target.id, false));
        setStatus('missed');
      }
    }
  };

  const replay = () => {
    if (round) speaker.speak(wordPrompt(round.target.text));
  };

  return { round, status, celebration, wrongIds, choose, replay, next: startRound };
}
```

- [ ] **Step 3: Implement `src/ui/Feedback.tsx`**

```tsx
import { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { playChime } from './sound';

export function Feedback({ level }: { level: 'big' | 'small' }) {
  useEffect(() => {
    confetti({
      particleCount: level === 'big' ? 150 : 40,
      spread: level === 'big' ? 100 : 55,
      origin: { y: 0.6 },
    });
    playChime(level);
  }, [level]);

  return (
    <div className="feedback" role="status">
      {level === 'big' ? '🎉 Yay! 🎈' : '🎉 Nice!'}
    </div>
  );
}
```

- [ ] **Step 4: Implement `src/ui/PlayScreen.tsx`**

```tsx
import type { Profile, Word } from '../engine/types';
import type { Rng } from '../engine/random';
import type { Speaker } from '../engine/speech';
import { useGame } from './useGame';
import { Feedback } from './Feedback';

interface PlayScreenProps {
  profile: Profile;
  onProfileChange: (p: Profile) => void;
  words: Word[];
  speaker: Speaker;
  rng?: Rng;
}

export function PlayScreen(props: PlayScreenProps) {
  const { round, status, celebration, wrongIds, choose, replay, next } = useGame(props);
  if (!round) return null;

  return (
    <div className="play">
      <button className="speaker" aria-label="Hear the word again" onClick={replay}>
        🔊
      </button>
      <div className="cards">
        {round.choices.map((w, i) => {
          const reveal = status === 'missed' && w.id === round.target.id;
          return (
            <button
              key={w.id}
              className={`card ${wrongIds.has(w.id) ? 'faded' : ''} ${reveal ? 'reveal' : ''}`}
              style={{ animationDelay: `${i * 0.15}s` }}
              disabled={wrongIds.has(w.id) || status !== 'playing'}
              onClick={() => choose(w)}
            >
              {w.text}
            </button>
          );
        })}
      </div>
      {status !== 'playing' && (
        <div className="round-end">
          {status === 'won' && celebration && <Feedback level={celebration} />}
          {status === 'missed' && <p className="aw">aw…</p>}
          <button className="next" onClick={next}>
            Next
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Append styles to `src/index.css`**

```css
.play { display: flex; flex-direction: column; align-items: center; gap: 2rem; padding: 2rem; }
.speaker { font-size: 4rem; background: none; border: none; cursor: pointer; }
.cards { display: flex; flex-wrap: wrap; gap: 1.5rem; justify-content: center; }
.card {
  font-size: 2.5rem; padding: 1.5rem 2.5rem; border-radius: 1rem;
  border: 4px solid #7cc; background: #fff; cursor: pointer;
  transition: opacity 0.6s ease;
  /* Cards gently fall onto the screen; "backwards" keeps delayed cards hidden. */
  animation: fall 0.9s ease-out backwards;
}
.card.faded { opacity: 0; pointer-events: none; }
.card.reveal { border-color: #fc3; box-shadow: 0 0 20px #fc3; }
@keyframes fall {
  from { transform: translateY(-70vh) rotate(-3deg); opacity: 0; }
  60% { opacity: 1; }
  to { transform: translateY(0) rotate(0); opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
  .card { animation: none; }
}
.round-end { text-align: center; font-size: 2rem; }
.next { font-size: 1.5rem; padding: 0.75rem 2rem; border-radius: 0.75rem; cursor: pointer; }
```

- [ ] **Step 6: Write the integration test** (uses the spoken word to know the target)

`src/ui/PlayScreen.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { PlayScreen } from './PlayScreen';
import { createProfile } from '../engine/profiles';
import { newWordState } from '../engine/leitner';
import type { Profile, Word } from '../engine/types';
import type { Rng } from '../engine/random';

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

const W = (id: string): Word => ({ id, text: id, grade: 'preK', length: id.length });
const WORDS = ['cat', 'cot', 'can', 'car', 'dog', 'sun'].map(W);

function seeded(seed: number): Rng {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeProfile(mode: Profile['settings']['wrongAnswerMode'] = 'keepTrying'): Profile {
  const p = createProfile('id', 'A', '🦄');
  p.settings.wrongAnswerMode = mode;
  for (const w of WORDS) p.progress.words[w.id] = newWordState();
  return p;
}

function fakeSpeaker() {
  const spoken: string[] = [];
  return { spoken, speaker: { speak: (t: string) => spoken.push(t), cancel: () => {} } };
}

// The game speaks "Find the word, <word>!" — parse the target back out.
function lastSpokenTarget(spoken: string[]): string {
  const m = /Find the word, (\w+)!/.exec(spoken[spoken.length - 1]);
  if (!m) throw new Error(`unexpected prompt: ${spoken[spoken.length - 1]}`);
  return m[1];
}

// Pick a wrong word that is actually rendered on screen (only choiceCount
// of the WORDS appear in a round).
function renderedWrongCard(target: string): HTMLElement {
  for (const w of WORDS) {
    if (w.id === target) continue;
    const btn = screen.queryByRole('button', { name: w.id });
    if (btn) return btn;
  }
  throw new Error('no wrong card rendered');
}

it('speaks the carrier phrase and celebrates a first-try correct tap', async () => {
  const user = userEvent.setup();
  const { spoken, speaker } = fakeSpeaker();
  render(<PlayScreen profile={makeProfile()} onProfileChange={() => {}} words={WORDS} speaker={speaker} rng={seeded(1)} />);
  expect(spoken[spoken.length - 1]).toMatch(/^Find the word, \w+!$/);
  const target = lastSpokenTarget(spoken);
  await user.click(screen.getByRole('button', { name: target }));
  expect(screen.getByText('🎉 Yay! 🎈')).toBeInTheDocument();
});

it('shows the small celebration after a wrong-then-correct tap', async () => {
  const user = userEvent.setup();
  const { spoken, speaker } = fakeSpeaker();
  render(<PlayScreen profile={makeProfile()} onProfileChange={() => {}} words={WORDS} speaker={speaker} rng={seeded(2)} />);
  const target = lastSpokenTarget(spoken);
  await user.click(renderedWrongCard(target));
  await user.click(screen.getByRole('button', { name: target }));
  expect(screen.getByText('🎉 Nice!')).toBeInTheDocument();
});

it('ends the round and reveals the answer on a wrong tap in oneAndDone mode', async () => {
  const user = userEvent.setup();
  const { spoken, speaker } = fakeSpeaker();
  render(<PlayScreen profile={makeProfile('oneAndDone')} onProfileChange={() => {}} words={WORDS} speaker={speaker} rng={seeded(3)} />);
  const target = lastSpokenTarget(spoken);
  await user.click(renderedWrongCard(target));
  expect(screen.getByText('aw…')).toBeInTheDocument();
  // The correct card is highlighted so the child still learns the answer.
  expect(screen.getByRole('button', { name: target })).toHaveClass('reveal');
});
```

- [ ] **Step 7: Run the test**

Run: `npx vitest run src/ui/PlayScreen.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add play screen, game hook, and celebration feedback"
```

---

### Task 11: Profile select screen

**Files:**
- Create: `src/ui/ProfileSelect.tsx`
- Append styles: `src/index.css`
- Test: `src/ui/ProfileSelect.test.tsx`

**Interfaces:**
- Consumes: `SaveBlob` from `../engine/types`.
- Produces:
  - `ProfileSelect(props: { blob: SaveBlob; onPick: (id: string) => void; onCreate: (name: string, avatar: string) => void }): JSX.Element`

- [ ] **Step 1: Write the failing test**

`src/ui/ProfileSelect.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { ProfileSelect } from './ProfileSelect';
import { createProfile } from '../engine/profiles';
import type { SaveBlob } from '../engine/types';

function blobWith(...names: string[]): SaveBlob {
  return { version: 1, activeProfileId: null, profiles: names.map((n) => createProfile(n, n, '🦄')) };
}

it('lists existing profiles and picks one', async () => {
  const user = userEvent.setup();
  const onPick = vi.fn();
  render(<ProfileSelect blob={blobWith('Ada')} onPick={onPick} onCreate={() => {}} />);
  await user.click(screen.getByRole('button', { name: /Ada/ }));
  expect(onPick).toHaveBeenCalledWith('Ada');
});

it('creates a new player from the form', async () => {
  const user = userEvent.setup();
  const onCreate = vi.fn();
  render(<ProfileSelect blob={blobWith()} onPick={() => {}} onCreate={onCreate} />);
  await user.type(screen.getByLabelText('New player name'), 'Bo');
  await user.click(screen.getByRole('button', { name: 'Add player' }));
  expect(onCreate).toHaveBeenCalledWith('Bo', expect.any(String));
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/ui/ProfileSelect.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/ui/ProfileSelect.tsx`**

```tsx
import { useState } from 'react';
import type { SaveBlob } from '../engine/types';

const AVATARS = ['🦄', '🐯', '🐸', '🐙', '🦊', '🐝'];

interface ProfileSelectProps {
  blob: SaveBlob;
  onPick: (id: string) => void;
  onCreate: (name: string, avatar: string) => void;
}

export function ProfileSelect({ blob, onPick, onCreate }: ProfileSelectProps) {
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(AVATARS[0]);

  return (
    <div className="select">
      <h1>Who's playing?</h1>
      <ul className="profiles">
        {blob.profiles.map((p) => (
          <li key={p.id}>
            <button onClick={() => onPick(p.id)}>
              {p.avatar} {p.name}
            </button>
          </li>
        ))}
      </ul>
      <form
        className="new-player"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) onCreate(name.trim(), avatar);
        }}
      >
        <div className="avatars">
          {AVATARS.map((a) => (
            <button
              type="button"
              key={a}
              className={a === avatar ? 'sel' : ''}
              onClick={() => setAvatar(a)}
            >
              {a}
            </button>
          ))}
        </div>
        <input
          aria-label="New player name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
        />
        <button type="submit">Add player</button>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: Append styles to `src/index.css`**

```css
.select { max-width: 480px; margin: 0 auto; padding: 2rem; text-align: center; }
.profiles { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 0.75rem; }
.profiles button { font-size: 1.75rem; padding: 1rem; border-radius: 0.75rem; cursor: pointer; width: 100%; }
.avatars { display: flex; gap: 0.5rem; justify-content: center; margin-bottom: 0.75rem; }
.avatars button { font-size: 1.75rem; padding: 0.5rem; border-radius: 0.5rem; cursor: pointer; }
.avatars button.sel { outline: 3px solid #7cc; }
.new-player input { font-size: 1.25rem; padding: 0.5rem; margin-right: 0.5rem; }
```

- [ ] **Step 5: Run the test**

Run: `npx vitest run src/ui/ProfileSelect.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add profile select screen"
```

---

### Task 12: Settings + App wiring

**Files:**
- Create: `src/ui/Settings.tsx`
- Rewrite: `src/ui/App.tsx`
- Update: `src/smoke.test.tsx` (App now loads asynchronously)
- Append styles: `src/index.css`
- Test: `src/ui/Settings.test.tsx`, `src/ui/App.test.tsx`

**Interfaces:**
- Consumes: everything above — `LocalStorageProfileStore`, `EMPTY_BLOB`, `createSpeaker`, `allWords`, `createProfile`, `upsertProfile`, `PlayScreen`, `ProfileSelect`.
- Produces:
  - `Settings(props: { profile: Profile; onChange: (p: Profile) => void; onBack: () => void }): JSX.Element`
  - `App(): JSX.Element` — loads the blob, routes between select/play/settings, and persists on every change.

- [ ] **Step 1: Write the failing Settings test**

`src/ui/Settings.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { Settings } from './Settings';
import { createProfile } from '../engine/profiles';

it('toggles wrong-answer mode to oneAndDone', async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<Settings profile={createProfile('id', 'A', '🦄')} onChange={onChange} onBack={() => {}} />);
  await user.click(screen.getByRole('checkbox'));
  expect(onChange).toHaveBeenCalledWith(
    expect.objectContaining({ settings: { wrongAnswerMode: 'oneAndDone' } }),
  );
});
```

- [ ] **Step 2: Implement `src/ui/Settings.tsx`**

```tsx
import type { Profile } from '../engine/types';

interface SettingsProps {
  profile: Profile;
  onChange: (p: Profile) => void;
  onBack: () => void;
}

export function Settings({ profile, onChange, onBack }: SettingsProps) {
  const mode = profile.settings.wrongAnswerMode;
  return (
    <div className="settings">
      <h1>Settings — {profile.name}</h1>
      <label className="setting-row">
        <input
          type="checkbox"
          checked={mode === 'oneAndDone'}
          onChange={(e) =>
            onChange({
              ...profile,
              settings: {
                ...profile.settings,
                wrongAnswerMode: e.target.checked ? 'oneAndDone' : 'keepTrying',
              },
            })
          }
        />
        Stop after a wrong answer (harder)
      </label>
      <button onClick={onBack}>Done</button>
    </div>
  );
}
```

- [ ] **Step 3: Run Settings test**

Run: `npx vitest run src/ui/Settings.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 4: Rewrite `src/ui/App.tsx`**

```tsx
import { useCallback, useEffect, useState } from 'react';
import type { Profile, SaveBlob } from '../engine/types';
import { LocalStorageProfileStore } from '../store/LocalStorageProfileStore';
import { createSpeaker } from '../engine/speech';
import { allWords } from '../engine/words';
import { createProfile, upsertProfile } from '../engine/profiles';
import { ProfileSelect } from './ProfileSelect';
import { PlayScreen } from './PlayScreen';
import { Settings } from './Settings';

const store = new LocalStorageProfileStore();
const speaker = createSpeaker();

type Screen = 'select' | 'play' | 'settings';

export function App() {
  const [blob, setBlob] = useState<SaveBlob | null>(null);
  const [screen, setScreen] = useState<Screen>('select');

  useEffect(() => {
    store.load().then(setBlob);
  }, []);

  // Functional updates: two profile changes can land between renders (e.g.
  // introducing words + recording a result) — never merge into a stale blob.
  const update = useCallback((fn: (prev: SaveBlob) => SaveBlob) => {
    setBlob((prev) => {
      if (!prev) return prev;
      const next = fn(prev);
      void store.save(next);
      return next;
    });
  }, []);

  if (!blob) return <div className="loading">Loading…</div>;

  const active = blob.profiles.find((p) => p.id === blob.activeProfileId) ?? null;

  if (screen === 'select' || !active) {
    return (
      <ProfileSelect
        blob={blob}
        onPick={(id) => {
          update((prev) => ({ ...prev, activeProfileId: id }));
          setScreen('play');
        }}
        onCreate={(name, avatar) => {
          const p = createProfile(crypto.randomUUID(), name, avatar);
          update((prev) => upsertProfile({ ...prev, activeProfileId: p.id }, p));
          setScreen('play');
        }}
      />
    );
  }

  const onProfileChange = (p: Profile) => update((prev) => upsertProfile(prev, p));

  if (screen === 'settings') {
    return <Settings profile={active} onChange={onProfileChange} onBack={() => setScreen('play')} />;
  }

  return (
    <div className="app">
      <header className="topbar">
        <span className="who">
          {active.avatar} {active.name}
        </span>
        <span className="spacer" />
        <button aria-label="Settings" onClick={() => setScreen('settings')}>
          ⚙️
        </button>
        <button aria-label="Switch player" onClick={() => setScreen('select')}>
          👥
        </button>
      </header>
      <PlayScreen
        key={active.id}
        profile={active}
        onProfileChange={onProfileChange}
        words={allWords()}
        speaker={speaker}
      />
    </div>
  );
}
```

- [ ] **Step 5: Update `src/smoke.test.tsx`** (App now renders "Loading…" then the select screen)

```ts
import { render, screen } from '@testing-library/react';
import { App } from './ui/App';

it('renders the profile select screen after load', async () => {
  render(<App />);
  expect(await screen.findByText("Who's playing?")).toBeInTheDocument();
});
```

- [ ] **Step 6: Write the App flow test**

`src/ui/App.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, beforeEach } from 'vitest';
import { App } from './App';

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

beforeEach(() => localStorage.clear());

it('creates a player and lands in the game', async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.type(await screen.findByLabelText('New player name'), 'Bo');
  await user.click(screen.getByRole('button', { name: 'Add player' }));
  // The game screen shows the replay speaker button.
  expect(await screen.findByRole('button', { name: 'Hear the word again' })).toBeInTheDocument();
});

it('persists the created player across reloads', async () => {
  const user = userEvent.setup();
  const first = render(<App />);
  await user.type(await screen.findByLabelText('New player name'), 'Bo');
  await user.click(screen.getByRole('button', { name: 'Add player' }));
  await screen.findByRole('button', { name: 'Hear the word again' });
  first.unmount();

  // A fresh mount opens on the "who's playing?" screen; Bo should be listed.
  render(<App />);
  expect(await screen.findByRole('button', { name: /Bo/ })).toBeInTheDocument();
});
```

- [ ] **Step 7: Append styles to `src/index.css`**

```css
.topbar { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem; background: #eef; }
.topbar .who { font-size: 1.25rem; }
.topbar .spacer { flex: 1; }
.topbar button { font-size: 1.5rem; background: none; border: none; cursor: pointer; }
.settings { max-width: 480px; margin: 0 auto; padding: 2rem; }
.setting-row { display: flex; align-items: center; gap: 0.75rem; font-size: 1.25rem; margin: 1.5rem 0; }
.loading { padding: 2rem; text-align: center; font-size: 1.5rem; }
```

- [ ] **Step 8: Run all tests and the build**

Run: `npx vitest run`
Expected: PASS (all suites).
Then: `npm run build`
Expected: build succeeds.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: wire App with profile routing, settings, and persistence"
```

---

## Manual Verification (after Task 12)

Run `npm run dev`, open the app in **Chrome**, and confirm:
1. "Who's playing?" → add a player → lands in the game.
2. Word cards **gently fall** onto the screen, staggered.
3. The word is spoken as **"Find the word, …!"**; tapping the correct card fires confetti + "Yay!"; tapping a wrong card first fades it and the eventual correct tap shows the smaller "Nice!".
4. The 🔊 button replays the phrase.
5. Settings (⚙️) toggles "stop after a wrong answer"; in that mode a wrong tap ends the round with "aw…" **and the correct card glows** before Next.
6. Reload the page — the player and their progress persist.
7. Play many rounds — words that were tapped wrong recur sooner than mastered ones, the same word is never the target twice in a row, and well-known words start showing more (4–5) and more confusable choices.
8. No round ever shows a homophone pair together (e.g. to/too/two).

---

## Self-Review Notes (traceability to spec)

- **Mode A (Listen & Find):** Tasks 8, 10 — target spoken, matching word tapped among decoys.
- **Per-word difficulty (choices 3→5, nearness 0→0.8; up at box ≥4, down after 2 consecutive misses):** Tasks 2 (`WordState`), 3 (`recordResult`), 8 (`buildRound` uses the target's figures).
- **Homophones never co-shown:** Tasks 4 (`homophones.ts`), 8 (`pickDecoys` filter).
- **No immediate target repeat:** Tasks 8 (`buildRound` exclusion), 10 (`lastTargetId`).
- **Falling word cards:** Task 10 (CSS `fall` keyframes, staggered delays, reduced-motion respected).
- **Carrier phrase "Find the word, …!":** Tasks 9 (`wordPrompt`), 10 (`useGame` speaks it).
- **Dolch grade lists, lowercased:** Task 2.
- **Auto-advance + trickle:** Task 7 (`introduceIfNeeded`).
- **Leitner 5 boxes, correct→+1, wrong→box1, weighted low-box draw:** Tasks 3, 8.
- **Multiple local profiles, single JSON blob behind `ProfileStore`, stable list order:** Tasks 6, 12.
- **Celebration tiers (big / small / none) + oneAndDone answer reveal:** Task 10 (`useGame`, `Feedback`, `reveal` class).
- **keepTrying default, oneAndDone opt-in:** Tasks 10, 12.
- **TTS Google US English + fallback, isolated in speech.ts, tap-to-replay, StrictMode-safe single speak:** Tasks 9, 10.
- **Not a dexterity game:** no timers anywhere; motion is CSS-only and decorative.
- **Mode C (Spell It) future:** not built; types/engine don't preclude it.
