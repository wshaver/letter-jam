# Letter Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **All work happens in the worktree `F:/Projects/letter-jam-wt/letter-mode` on branch `feat/letter-mode`.**

**Goal:** A per-profile "letters" mode drilling letter recognition (uppercase first, lowercase trickling in) using the existing engine — letters become dictionary entries with their own confusability table and "A is for apple" prompts.

**Architecture:** The build script generates 52 letter entries (grades `lettersUpper`/`lettersLower` preceding preK) with template sentences; `similarity()` delegates to a letter-confusion table for single-char inputs; the decoy filter gains case-insensitive-equality exclusion; `introduceIfNeeded` scopes its counting to the active pool; `Profile.settings.gameMode` selects the pool in App.

**Tech Stack:** unchanged.

## Global Constraints

- **52 letter entries:** ids `letter-<x>-uc` / `letter-<x>-lc`, text `'A'`/`'a'` (the one exception to the lowercase-text convention), `length: 1`, `tags: ['letter','upper']` / `['letter','lower']`, grades `lettersUpper` / `lettersLower`. Dictionary total **365** (313 words + 52 letters).
- **Grade order:** `GRADES = ['lettersUpper', 'lettersLower', 'preK', 'K', '1', '2', '3']`.
- **Letter sentences:** template `` `${UC} is for ${flagship}.` `` (x uses `We find x in fox.`); flagships per letter as listed in Task 1; `FLAGSHIP_EXTRAS = ['ice','queen','fox','zoo']` are sentence-only words (never entries); build fails if a flagship is neither a dictionary word nor an extra. Both cases of a letter share the same sentence. Letter sentences are exempt from the word-sentence validator.
- **Case exclusion:** decoys whose text equals the target's text case-insensitively are never shown (A/a never co-appear).
- **Letter confusability:** `similarity(a,b)` returns the letter-table score when both inputs are single characters — same confusion group 0.9, different 0.1, case-sensitive groups as listed in Task 2.
- **Pool scoping:** `introduceIfNeeded` counts introduced/mastered only among ids present in the passed pool.
- **`gameMode: 'words' | 'letters'`** on `ProfileSettings`, default `'words'`; legacy blobs are defaulted at `load()`. `PlayScreen` remounts on mode change (`key` includes mode).
- Single-glyph cards render extra large (`.card.glyph` CSS).
- TypeScript strict; full suite + `npm run build` green at every task's commit; test command `npx vitest run <path>`.

---

### Task 1: Letter entries + grades + letter sentences

**Files:**
- Modify: `scripts/build-words.mjs`, `src/engine/types.ts` (Grade), `src/engine/session.ts` (GRADES), `src/engine/words.ts`
- Regenerate: `src/data/words.json`
- Test: `src/engine/words.test.ts`

**Interfaces:**
- Produces: 365-entry `words.json`; `Grade` union gains `'lettersUpper' | 'lettersLower'`; `wordsForMode(mode: 'words' | 'letters'): Word[]` in `src/engine/words.ts`. Later tasks rely on all three.

- [ ] **Step 1: Write the failing tests**

In `src/engine/words.test.ts`, change the count assertion in the existing noun test from `toBe(313)` to `toBe(365)`, change the sentence-containment line to compare lowercased text, and append:

```ts
it('includes 52 letter entries with letter grades and template sentences', () => {
  expect(wordById('letter-a-uc')).toMatchObject({
    text: 'A',
    grade: 'lettersUpper',
    length: 1,
    tags: ['letter', 'upper'],
    sentence: 'A is for apple.',
  });
  expect(wordById('letter-a-lc')).toMatchObject({
    text: 'a',
    grade: 'lettersLower',
    tags: ['letter', 'lower'],
    sentence: 'A is for apple.',
  });
  expect(wordById('letter-x-uc')?.sentence).toBe('We find x in fox.');
});

it('wordsForMode splits letters from words', () => {
  expect(wordsForMode('letters')).toHaveLength(52);
  expect(wordsForMode('words')).toHaveLength(313);
  expect(wordsForMode('letters').every((w) => w.tags?.includes('letter'))).toBe(true);
  expect(wordsForMode('words').some((w) => w.tags?.includes('letter'))).toBe(false);
});
```

The sentence-containment fix (existing test): `expect(w.sentence.toLowerCase(), w.id).toContain(w.text.toLowerCase());` (uppercase letter texts otherwise fail the lowercase comparison).

Run: `npx vitest run src/engine/words.test.ts` — Expected: FAIL.

- [ ] **Step 2: Extend the Grade union and GRADES**

`src/engine/types.ts`:
```ts
export type Grade = 'lettersUpper' | 'lettersLower' | 'preK' | 'K' | '1' | '2' | '3';
```

`src/engine/session.ts`:
```ts
export const GRADES: Grade[] = ['lettersUpper', 'lettersLower', 'preK', 'K', '1', '2', '3'];
```

- [ ] **Step 3: Generate letters in `scripts/build-words.mjs`**

Insert after the `for (const w of words) w.sentence = SENTENCES[w.text];` line (letters are appended AFTER word-sentence validation so the word validator never sees them, and BEFORE the duplicate-id guard — move the guard down accordingly):

```js
// --- letters ------------------------------------------------------------
// 52 letter entries for letter-recognition mode. Uppercase is the first
// band a letters-mode profile meets; lowercase trickles in after mastery.
// Sentences use the "X is for <flagship>." template; both cases share one.
const LETTER_FLAGSHIPS = {
  a: 'apple', b: 'ball', c: 'cat', d: 'dog', e: 'egg', f: 'fish', g: 'garden',
  h: 'house', i: 'ice', j: 'jump', k: 'kitty', l: 'letter', m: 'milk',
  n: 'nest', o: 'open', p: 'pig', q: 'queen', r: 'rabbit', s: 'sun',
  t: 'tree', u: 'up', v: 'very', w: 'water', x: 'fox', y: 'yellow', z: 'zoo',
};
// Flagship words that are not dictionary entries; letter sentences only.
const FLAGSHIP_EXTRAS = ['ice', 'queen', 'fox', 'zoo'];

const vocabSet = new Set(words.map((w) => w.text));
for (const [letter, flagship] of Object.entries(LETTER_FLAGSHIPS)) {
  if (!vocabSet.has(flagship) && !FLAGSHIP_EXTRAS.includes(flagship)) {
    console.error(`Letter flagship "${flagship}" (for "${letter}") is not a dictionary word or a listed extra`);
    process.exit(1);
  }
}

function letterSentence(letter) {
  if (letter === 'x') return 'We find x in fox.';
  return `${letter.toUpperCase()} is for ${LETTER_FLAGSHIPS[letter]}.`;
}

for (const letter of 'abcdefghijklmnopqrstuvwxyz') {
  const sentence = letterSentence(letter);
  words.push({ id: `letter-${letter}-uc`, text: letter.toUpperCase(), grade: 'lettersUpper', length: 1, tags: ['letter', 'upper'], sentence });
  words.push({ id: `letter-${letter}-lc`, text: letter, grade: 'lettersLower', length: 1, tags: ['letter', 'lower'], sentence });
}
```

Then MOVE the existing duplicate-id guard (the `const ids = new Set(...)` block) so it runs after this letters block (it now checks all 365).

- [ ] **Step 4: Add `wordsForMode` to `src/engine/words.ts`**

```ts
export function wordsForMode(mode: 'words' | 'letters'): Word[] {
  return words.filter((w) => (w.tags?.includes('letter') ?? false) === (mode === 'letters'));
}
```

- [ ] **Step 5: Regenerate and verify**

Run: `npm run build:words` — Expected: `Wrote 365 words ...`, zero errors.
Run: `npx vitest run src/engine/words.test.ts` — Expected: PASS.
Run: `npx vitest run` then `npm run build` — Expected: all green (App tests are unaffected: they don't assert word counts, and the words-mode pool change lands in Task 4).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add letter entries with letter grades and flagship sentences"
```

---

### Task 2: Engine behavior — letter confusability, case exclusion, pool scoping

**Files:**
- Modify: `src/engine/similarity.ts`, `src/engine/roundBuilder.ts`, `src/engine/session.ts`
- Test: `src/engine/similarity.test.ts`, `src/engine/roundBuilder.test.ts`, `src/engine/session.test.ts`

**Interfaces:**
- Consumes: Task 1's letter entries/`Grade`.
- Produces: `letterSimilarity(a, b): number` (exported from similarity.ts); `similarity` delegating for single chars; `pickDecoys` excluding case-insensitive text matches; `introduceIfNeeded` scoped to the passed pool.

- [ ] **Step 1: Write the failing tests**

Append to `src/engine/similarity.test.ts`:
```ts
it('scores single characters by visual confusion group', () => {
  expect(similarity('b', 'd')).toBe(0.9); // same lowercase group
  expect(similarity('B', 'D')).toBe(0.9); // same uppercase group
  expect(similarity('b', 'D')).toBe(0.1); // groups are case-specific
  expect(similarity('A', 'x')).toBe(0.1); // unrelated
  expect(similarity('a', 'a')).toBe(1);
});
```

Append to `src/engine/roundBuilder.test.ts`:
```ts
it('never shows the other case of the target letter', () => {
  const upper: Word = { id: 'letter-a-uc', text: 'A', grade: 'lettersUpper', length: 1, sentence: 'A is for apple.', tags: ['letter', 'upper'] };
  const lower: Word = { id: 'letter-a-lc', text: 'a', grade: 'lettersLower', length: 1, sentence: 'A is for apple.', tags: ['letter', 'lower'] };
  const others = ['B', 'C', 'D', 'E'].map((t) => ({ id: `letter-${t.toLowerCase()}-uc`, text: t, grade: 'lettersUpper' as const, length: 1, sentence: `${t} is for x.`, tags: ['letter', 'upper'] }));
  const pool = [upper, lower, ...others];
  for (let seed = 0; seed < 20; seed++) {
    const ids = pickDecoys(upper, pool, { choiceCount: 5, decoyNearness: 0.5 }, seeded(seed)).map((w) => w.id);
    expect(ids).not.toContain('letter-a-lc');
  }
});
```

Append to `src/engine/session.test.ts`:
```ts
it('scopes introduction counting to the passed pool', () => {
  // Profile has mastered out-of-pool (letter) items; the word pool must
  // still get its own initial batch rather than being treated as underway.
  const p = createProfile('id', 'A', '🦄');
  p.progress.words['letter-a-uc'] = { ...newWordState(), box: 5 };
  const introduced = introduceIfNeeded(p, WORDS);
  const wordIds = Object.keys(introduced.progress.words).filter((id) => !id.startsWith('letter-'));
  expect(wordIds).toHaveLength(DEFAULT_SESSION_CONFIG.initialBatch);
});
```
(Add `import { newWordState } from './leitner';` to session.test.ts.)

Run all three test files — Expected: FAIL.

- [ ] **Step 2: Implement letter confusability in `src/engine/similarity.ts`**

Add before `similarity`:
```ts
// Visual confusion groups for single glyphs (case-specific — 'b'/'d' confuse,
// 'B'/'D' confuse, but 'b'/'D' do not). Tunable with real-child feedback.
const LETTER_CONFUSIONS: string[][] = [
  ['b', 'd', 'p', 'q'], ['m', 'w'], ['n', 'u'], ['i', 'l', 'j'], ['c', 'e', 'o'],
  ['a', 'o'], ['f', 't'], ['h', 'n'], ['v', 'y', 'w'], ['s', 'z'], ['g', 'q'],
  ['O', 'Q', 'C', 'G'], ['E', 'F'], ['M', 'W'], ['N', 'Z'], ['I', 'L', 'J', 'T'],
  ['U', 'V', 'Y'], ['P', 'R', 'B', 'D'], ['K', 'X'],
];

export function letterSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  return LETTER_CONFUSIONS.some((g) => g.includes(a) && g.includes(b)) ? 0.9 : 0.1;
}
```

And make `similarity` delegate as its FIRST statement (before any lowercasing — case is the content for glyphs):
```ts
export function similarity(a: string, b: string): number {
  if (a.length === 1 && b.length === 1) return letterSimilarity(a, b);
  // ... existing body unchanged ...
```

- [ ] **Step 3: Case exclusion in `src/engine/roundBuilder.ts`**

In `pickDecoys`, extend the candidate filter:
```ts
    .filter(
      (w) =>
        w.id !== target.id &&
        // The other case of the same glyph answers the same spoken prompt.
        w.text.toLowerCase() !== target.text.toLowerCase() &&
        !areHomophones(target.text, w.text),
    )
```

- [ ] **Step 4: Pool scoping in `src/engine/session.ts`**

In `introduceIfNeeded`, replace the `introducedIds` line:
```ts
  const poolIds = new Set(words.map((w) => w.id));
  const introducedIds = Object.keys(state).filter((id) => state[id].introduced && poolIds.has(id));
```

- [ ] **Step 5: Verify**

Run: `npx vitest run src/engine/similarity.test.ts src/engine/roundBuilder.test.ts src/engine/session.test.ts` — Expected: PASS.
Run: `npx vitest run` and `npm run build` — Expected: green.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: letter confusability, case exclusion, and pool-scoped introduction"
```

---

### Task 3: gameMode on profiles + storage defaulting

**Files:**
- Modify: `src/engine/types.ts` (ProfileSettings), `src/engine/profiles.ts`, `src/store/LocalStorageProfileStore.ts`
- Test: `src/engine/profiles.test.ts`, `src/store/LocalStorageProfileStore.test.ts`

**Interfaces:**
- Produces: `ProfileSettings.gameMode: 'words' | 'letters'`; `createProfile` defaults it to `'words'`; `load()` backfills it on legacy blobs. Task 4 consumes `settings.gameMode`.

- [ ] **Step 1: Write the failing tests**

In `src/engine/profiles.test.ts`, extend the createProfile test:
```ts
  expect(p.settings.gameMode).toBe('words');
```

Append to `src/store/LocalStorageProfileStore.test.ts`:
```ts
it('defaults gameMode on legacy blobs that predate it', async () => {
  const legacy = {
    version: 1,
    activeProfileId: 'x',
    profiles: [{ id: 'x', name: 'Old', avatar: '🦄', settings: { wrongAnswerMode: 'oneAndDone' }, progress: { words: {}, stats: { rounds: 0, correctFirstTry: 0 } } }],
  };
  localStorage.setItem('letter-jam-save-v1', JSON.stringify(legacy));
  const store = new LocalStorageProfileStore();
  const blob = await store.load();
  expect(blob.profiles[0].settings.gameMode).toBe('words');
  expect(blob.profiles[0].settings.wrongAnswerMode).toBe('oneAndDone'); // preserved
});
```

Run both files — Expected: FAIL.

- [ ] **Step 2: Implement**

`src/engine/types.ts`:
```ts
export interface ProfileSettings {
  wrongAnswerMode: 'keepTrying' | 'oneAndDone';
  gameMode: 'words' | 'letters'; // default 'words'
}
```

`src/engine/profiles.ts` — `createProfile` settings become:
```ts
    settings: { wrongAnswerMode: 'keepTrying', gameMode: 'words' },
```

`src/store/LocalStorageProfileStore.ts` — in `load()`, after parsing:
```ts
    try {
      const blob = JSON.parse(raw) as SaveBlob;
      // Backfill settings added after a blob was saved (e.g. gameMode).
      for (const p of blob.profiles) {
        p.settings = { wrongAnswerMode: 'keepTrying', gameMode: 'words', ...p.settings };
      }
      return blob;
    } catch {
      return structuredClone(EMPTY_BLOB);
    }
```

- [ ] **Step 3: Verify**

Run: `npx vitest run src/engine/profiles.test.ts src/store/LocalStorageProfileStore.test.ts` — Expected: PASS.
Run: `npx vitest run` and `npm run build` — Expected: green.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add gameMode profile setting with legacy-blob defaulting"
```

---

### Task 4: UI — Settings toggle, pool selection, big glyph cards

**Files:**
- Modify: `src/ui/Settings.tsx`, `src/ui/App.tsx`, `src/ui/PlayScreen.tsx`, `src/index.css` (append)
- Test: `src/ui/Settings.test.tsx`, `src/ui/App.test.tsx`

**Interfaces:**
- Consumes: `wordsForMode` (Task 1), `settings.gameMode` (Task 3).

- [ ] **Step 1: Write the failing tests**

Append to `src/ui/Settings.test.tsx`:
```tsx
it('toggles gameMode to letters', async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<Settings profile={createProfile('id', 'A', '🦄')} onChange={onChange} onBack={() => {}} />);
  await user.click(screen.getByRole('checkbox', { name: /letter mode/i }));
  expect(onChange).toHaveBeenCalledWith(
    expect.objectContaining({ settings: expect.objectContaining({ gameMode: 'letters' }) }),
  );
});
```

Append to `src/ui/App.test.tsx`:
```tsx
it('letters mode shows single-glyph cards', async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.type(await screen.findByLabelText('New player name'), 'Tot');
  await user.click(screen.getByRole('button', { name: 'Add player' }));
  await screen.findByRole('button', { name: 'Hear the word again' });
  await user.click(screen.getByRole('button', { name: 'Settings' }));
  await user.click(screen.getByRole('checkbox', { name: /letter mode/i }));
  await user.click(screen.getByRole('button', { name: 'Done' }));
  await screen.findByRole('button', { name: 'Hear the word again' });
  const cards = document.querySelectorAll('.card');
  expect(cards.length).toBeGreaterThanOrEqual(3);
  for (const c of cards) expect((c.textContent ?? '').length).toBe(1);
});
```
(The existing Settings wrongAnswerMode test targets its checkbox by role only — it now needs a name: change `screen.getByRole('checkbox')` to `screen.getByRole('checkbox', { name: /stop after a wrong answer/i })`.)

Run both files — Expected: FAIL.

- [ ] **Step 2: Settings toggle in `src/ui/Settings.tsx`**

Add a second setting row below the existing one:
```tsx
      <label className="setting-row">
        <input
          type="checkbox"
          checked={profile.settings.gameMode === 'letters'}
          onChange={(e) =>
            onChange({
              ...profile,
              settings: {
                ...profile.settings,
                gameMode: e.target.checked ? 'letters' : 'words',
              },
            })
          }
        />
        Letter mode (letter recognition for little ones)
      </label>
```

- [ ] **Step 3: Pool selection in `src/ui/App.tsx`**

Change the words import to `import { wordsForMode } from '../engine/words';` (drop `allWords` if now unused) and the PlayScreen render to:
```tsx
      <PlayScreen
        key={`${active.id}:${active.settings.gameMode}`}
        profile={active}
        onProfileChange={onProfileChange}
        words={wordsForMode(active.settings.gameMode)}
        speaker={speaker}
      />
```
(The key includes the mode so switching modes remounts the game with the new pool.)

- [ ] **Step 4: Big glyph cards**

In `src/ui/PlayScreen.tsx`, extend the card className:
```tsx
className={`card ${w.text.length === 1 ? 'glyph' : ''} ${wrongIds.has(w.id) ? 'faded' : ''} ${reveal ? 'reveal' : ''}`}
```

Append to `src/index.css`:
```css
.card.glyph { font-size: 5rem; padding: 1.5rem 3rem; line-height: 1; }
```

- [ ] **Step 5: Verify**

Run: `npx vitest run src/ui/Settings.test.tsx src/ui/App.test.tsx` — Expected: PASS.
Run: `npx vitest run` and `npm run build` — Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: letters mode setting, pool selection, and glyph cards"
```

---

## Manual Verification (after Task 4)

In Chrome (dev server or vhost after merge+build):
1. Create a profile, Settings → enable Letter mode → cards are big single uppercase letters; prompt speaks "A. A is for apple. A." (🔊 replays).
2. 'A' and 'a' never on screen together; early rounds show visually distinct letters, later (after wins) confusable ones (b/d, E/F).
3. Toggle back to words — word rounds resume with prior word progress intact.
4. Reload — mode setting persists.

## Self-Review Notes (traceability to spec)

- **gameMode per profile, default words, legacy backfill:** Task 3.
- **52 entries, ids/tags/grades, GRADES order:** Task 1.
- **Case exclusion:** Task 2 Step 3. **Confusion table + delegation:** Task 2 Step 2.
- **Pool scoping:** Task 2 Step 4 (+ test).
- **"X is for" sentences, flagship allowance, x-pattern, shared across cases, exempt from word validator:** Task 1 Step 3 (letters appended after `validateSentences`).
- **Big glyph cards:** Task 4 Step 4. **Pool selection + remount on mode change:** Task 4 Step 3.
- **Fonts:** deferred per spec; nothing here precludes it.
