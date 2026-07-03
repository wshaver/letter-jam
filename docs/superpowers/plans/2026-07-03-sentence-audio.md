# Sentence Audio + Noun Dictionary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the "Find the word, X!" prompt with a three-part sentence prompt ("Dog. The red dog sat. Dog.") and add the Dolch 93 nouns to the game dictionary, with an authored, build-validated sentence for every word.

**Architecture:** The noun list and a `{ word: sentence }` map live in `scripts/`; `build-words.mjs` merges both into `src/data/words.json` and **fails the build** on any sentence-rule violation. `Word` gains a required `sentence` field; `wordPrompt(word, sentence)` formats the prompt; `useGame` passes the target's sentence. Sentences are drafted by parallel content subagents (coordinator-orchestrated, before Task 2) into a draft file the Task 2 implementer integrates.

**Tech Stack:** unchanged (React 19, Vite 7, TS strict, Vitest 3).

## Global Constraints

- **Prompt format (exact):** `wordPrompt(word, sentence)` returns `` `${Cap(word)}. ${sentence} ${Cap(word)}.` `` — e.g. `Dog. The red dog sat. Dog.` Replay speaks the same full prompt. UI tests parse the leading `Word.` token.
- **Noun additions:** exactly the 93 nouns listed in Task 1 (Dolch 95 minus "Santa Claus" and "good-bye"; **"christmas" kept, lowercase**). Tagged `tags: ['noun']`. Grade banded by length: ≤3 → preK, 4 → K, 5 → 1, 6 → 2, 7+ → 3. Dictionary total: **313 words**.
- **New homophone groups:** `['i', 'eye']` and `['would', 'wood']`.
- **Sentence rules (validator-enforced, build fails otherwise):** present for every word; starts with a capital, ends with a period; contains the target word (word-boundary, case-insensitive); target is not the first or last token unless the word is in `EDGE_EXCEPTIONS`; every token is in the allowed vocabulary = 313 words ∪ inflections (`+s`, `+es`, `+d`, `+ed`, `+ing`, e-drop `-ing`, final-consonant doubling `-ing`/`-ed`, `y→ies`/`ied`) ∪ `EXTRA_FORMS`.
- **Words stored lowercase**; TypeScript strict; test command `npx vitest run <path>`; full suite + `npm run build` green at every task's commit.
- After final merge, `npm run build` must be run so the Apache vhost (serves `dist/`) picks up the change.

---

## File Structure

```
scripts/
  build-words.mjs        # + noun list, sentence merge, validator (Task 1, 2)
  sentences.mjs          # SENTENCES map + EDGE_EXCEPTIONS + EXTRA_FORMS (Task 2)
src/
  data/words.json        # regenerated: 313 words, each with sentence (Task 1, 2)
  engine/
    types.ts             # Word.sentence: string (Task 2)
    homophones.ts        # + i/eye, would/wood (Task 1)
    speech.ts            # wordPrompt(word, sentence) (Task 3)
  ui/useGame.ts          # pass target.sentence (Task 3)
```

## Coordinator Pre-Step (before dispatching Task 2)

The coordinator (not a plan task) drafts the 313 sentences:

1. After Task 1 lands, extract the full word list: `node -e "const w=require('./src/data/words.json'); console.log(w.map(x=>x.text).join(' '))"`.
2. Dispatch **4 parallel content-authoring agents** (no file edits — they return text). Each gets: the full 313-word vocabulary, the allowed-inflection rules and sentence rules from Global Constraints, an assigned alphabetical slice (~78 words), and this output contract: one line per word, exactly `  word: 'Sentence here.',` (single-quoted, escape internal apostrophes), no other text.
3. Assemble the four batches into `.superpowers/sdd/sentences-draft.mjs` in this shape, and hand the path to the Task 2 implementer:

```js
export const SENTENCES = {
  // ...313 entries...
};
export const EDGE_EXCEPTIONS = []; // words allowed at sentence edges
export const EXTRA_FORMS = ['sat']; // irregular forms outside the inflection rules
```

The Task 2 implementer owns fixing every validator failure (rewriting sentences, or adding genuinely-needed entries to `EDGE_EXCEPTIONS`/`EXTRA_FORMS` — each extra form must be an inflection of a dictionary word, never new vocabulary).

---

### Task 1: Noun dictionary + homophone groups

**Files:**
- Modify: `scripts/build-words.mjs`
- Modify: `src/engine/homophones.ts`
- Regenerate: `src/data/words.json`
- Test: `src/engine/words.test.ts`, `src/engine/homophones.test.ts`

**Interfaces:**
- Consumes: existing `DOLCH` grade lists in `build-words.mjs`; existing `HOMOPHONE_GROUPS` in `homophones.ts`.
- Produces: `words.json` with 313 entries; noun entries shaped `{ id, text, grade, length, tags: ['noun'] }`. Task 2 relies on the 313-word total and the `tags` field.

- [ ] **Step 1: Write the failing tests**

Append to `src/engine/words.test.ts`:
```ts
it('includes Dolch nouns with length-banded grades and the noun tag', () => {
  expect(allWords().length).toBe(313);
  expect(wordById('dog')).toMatchObject({ grade: 'preK', tags: ['noun'] });
  expect(wordById('ball')).toMatchObject({ grade: 'K', tags: ['noun'] });
  expect(wordById('house')).toMatchObject({ grade: '1', tags: ['noun'] });
  expect(wordById('window')).toMatchObject({ grade: '2', tags: ['noun'] });
  expect(wordById('christmas')).toMatchObject({ grade: '3', tags: ['noun'] });
  expect(wordById('the')?.tags).toBeUndefined(); // service words untagged
});
```

Append to `src/engine/homophones.test.ts`:
```ts
it('covers the noun-created homophone groups', () => {
  expect(areHomophones('i', 'eye')).toBe(true);
  expect(areHomophones('would', 'wood')).toBe(true);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/engine/words.test.ts src/engine/homophones.test.ts`
Expected: FAIL (word count 220, `wordById('dog')` undefined, homophones false).

- [ ] **Step 3: Add the nouns to `scripts/build-words.mjs`**

After the `DOLCH` object, add:

```js
// Dolch 95 nouns, minus "Santa Claus" (two words) and "good-bye" (hyphenated).
// "christmas" kept lowercase by request. Grade is banded by length below.
const NOUNS = ['apple','baby','back','ball','bear','bed','bell','bird','birthday','boat','box','boy','bread','brother','cake','car','cat','chair','chicken','children','christmas','coat','corn','cow','day','dog','doll','door','duck','egg','eye','farm','farmer','father','feet','fire','fish','floor','flower','game','garden','girl','grass','ground','hand','head','hill','home','horse','house','kitty','leg','letter','man','men','milk','money','morning','mother','name','nest','night','paper','party','picture','pig','rabbit','rain','ring','robin','school','seed','sheep','shoe','sister','snow','song','squirrel','stick','street','sun','table','thing','time','top','toy','tree','watch','water','way','wind','window','wood'];

function nounGrade(text) {
  if (text.length <= 3) return 'preK';
  if (text.length === 4) return 'K';
  if (text.length === 5) return '1';
  if (text.length === 6) return '2';
  return '3';
}
```

And extend the word assembly (after the existing DOLCH loop):

```js
for (const text of NOUNS) {
  words.push({ id: text, text, grade: nounGrade(text), length: text.length, tags: ['noun'] });
}

const ids = new Set(words.map((w) => w.id));
if (ids.size !== words.length) {
  console.error('Duplicate word ids across DOLCH and NOUNS lists');
  process.exit(1);
}
```

- [ ] **Step 4: Add the homophone groups to `src/engine/homophones.ts`**

Append to `HOMOPHONE_GROUPS`:
```ts
  ['i', 'eye'],
  ['would', 'wood'],
```

- [ ] **Step 5: Regenerate and verify**

Run: `npm run build:words`
Expected: `Wrote 313 words to .../src/data/words.json`
Run: `npx vitest run src/engine/words.test.ts src/engine/homophones.test.ts`
Expected: PASS.
Run: `npx vitest run` then `npm run build`
Expected: all green (existing App/PlayScreen tests still pass — the initial six introduced words, a/i/go/in/is/it, are unchanged by the additions).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add Dolch nouns to the dictionary with noun-created homophone groups"
```

---

### Task 2: Sentences — data, validator, Word.sentence

**Files:**
- Create: `scripts/sentences.mjs` (from the coordinator's draft at the path given in your dispatch)
- Modify: `scripts/build-words.mjs` (merge + validator), `src/engine/types.ts`
- Regenerate: `src/data/words.json`
- Modify (fixtures): `src/engine/roundBuilder.test.ts`, `src/engine/session.test.ts`, `src/ui/PlayScreen.test.tsx`
- Test: `src/engine/words.test.ts`

**Interfaces:**
- Consumes: 313-word `words.json` from Task 1; the coordinator's sentences draft.
- Produces: `Word.sentence: string` (required) — Task 3's `wordPrompt(word, sentence)` consumes it; `SENTENCES`/`EDGE_EXCEPTIONS`/`EXTRA_FORMS` exports from `scripts/sentences.mjs`.

- [ ] **Step 1: Write the failing test**

Append to `src/engine/words.test.ts`:
```ts
it('every word carries a capitalized, period-terminated sentence containing it', () => {
  for (const w of allWords()) {
    expect(w.sentence, w.id).toMatch(/^[A-Z].*\.$/);
    expect(w.sentence.toLowerCase(), w.id).toContain(w.text);
  }
});
```

Run: `npx vitest run src/engine/words.test.ts` — Expected: FAIL (`sentence` undefined).

- [ ] **Step 2: Create `scripts/sentences.mjs`**

Copy the coordinator's draft file to `scripts/sentences.mjs` verbatim. Its shape:
```js
export const SENTENCES = { /* 313 entries: word: 'Sentence.', */ };
export const EDGE_EXCEPTIONS = [];
export const EXTRA_FORMS = ['sat'];
```

- [ ] **Step 3: Add merge + validator to `scripts/build-words.mjs`**

Import at top: `import { SENTENCES, EDGE_EXCEPTIONS, EXTRA_FORMS } from './sentences.mjs';`

After the duplicate-id check, add:

```js
// --- sentence validation -----------------------------------------------
// Every allowed token form: the vocabulary itself plus simple inflections.
function allowedForms(vocab) {
  const forms = new Set(vocab);
  for (const w of vocab) {
    forms.add(w + 's');
    forms.add(w + 'es');
    forms.add(w + 'd');
    forms.add(w + 'ed');
    forms.add(w + 'ing');
    if (w.endsWith('e')) forms.add(w.slice(0, -1) + 'ing'); // come -> coming
    const last = w[w.length - 1];
    if (!'aeiouy'.includes(last)) {
      forms.add(w + last + 'ing'); // run -> running
      forms.add(w + last + 'ed'); // stop -> stopped
    }
    if (w.endsWith('y')) {
      forms.add(w.slice(0, -1) + 'ies'); // baby -> babies
      forms.add(w.slice(0, -1) + 'ied'); // carry -> carried
    }
  }
  for (const f of EXTRA_FORMS) forms.add(f);
  return forms;
}

function validateSentences(words) {
  const forms = allowedForms(words.map((w) => w.text));
  const errors = [];
  for (const { text } of words) {
    const sentence = SENTENCES[text];
    if (!sentence) {
      errors.push(`${text}: missing sentence`);
      continue;
    }
    if (!/^[A-Z].*\.$/.test(sentence)) {
      errors.push(`${text}: must start capitalized and end with a period`);
    }
    const tokens = sentence
      .toLowerCase()
      .replace(/'/g, '')
      .replace(/[.,!?;:]/g, ' ')
      .split(/\s+/)
      .filter(Boolean);
    if (!tokens.includes(text)) {
      errors.push(`${text}: sentence does not contain the word`);
    }
    if ((tokens[0] === text || tokens[tokens.length - 1] === text) && !EDGE_EXCEPTIONS.includes(text)) {
      errors.push(`${text}: word is first or last (rewrite, or add to EDGE_EXCEPTIONS if unavoidable)`);
    }
    for (const t of tokens) {
      if (!forms.has(t)) errors.push(`${text}: token "${t}" not in allowed vocabulary`);
    }
  }
  if (errors.length) {
    console.error(`Sentence validation failed (${errors.length} errors):`);
    for (const e of errors) console.error('  ' + e);
    process.exit(1);
  }
}

validateSentences(words);
for (const w of words) w.sentence = SENTENCES[w.text];
```

(Ensure the `writeFileSync` happens AFTER this block so `words.json` carries sentences.)

- [ ] **Step 4: Fix every validator failure**

Run: `npm run build:words`. For each reported error, EDIT the offending sentence in `scripts/sentences.mjs` (preferred), or — only when genuinely unavoidable — add the word to `EDGE_EXCEPTIONS`, or add a legitimate inflection of a dictionary word to `EXTRA_FORMS` (never new vocabulary). Repeat until: `Wrote 313 words ...` with zero errors. Record in your report how many sentences you rewrote and every `EDGE_EXCEPTIONS`/`EXTRA_FORMS` addition.

- [ ] **Step 5: Add `sentence` to the Word type**

In `src/engine/types.ts`:
```ts
export interface Word {
  id: string;
  text: string;
  grade: Grade;
  length: number;
  sentence: string; // spoken context sentence, e.g. "The red dog sat."
  tags?: string[];
}
```

- [ ] **Step 6: Update test fixtures (type now requires `sentence`)**

In `src/engine/roundBuilder.test.ts` and `src/ui/PlayScreen.test.tsx`, the `W` helper becomes:
```ts
const W = (id: string): Word => ({ id, text: id, grade: 'preK', length: id.length, sentence: `We can see the ${id} now.` });
```
In `src/engine/session.test.ts`:
```ts
const W = (id: string, grade: Word['grade'], length: number): Word => ({ id, text: id, grade, length, sentence: `We can see the ${id} now.` });
```
(Fixture sentences are arbitrary — the validator only runs on the real data.)

- [ ] **Step 7: Verify everything**

Run: `npx vitest run` — Expected: all suites PASS (words test from Step 1 now green).
Run: `npm run build` — Expected: green (`tsc` checks the fixture updates).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add validated context sentences for all 313 words"
```

---

### Task 3: Three-part sentence prompt

**Files:**
- Modify: `src/engine/speech.ts`, `src/ui/useGame.ts`
- Test: `src/engine/speech.test.ts`, `src/ui/PlayScreen.test.tsx`

**Interfaces:**
- Consumes: `Word.sentence` from Task 2.
- Produces: `wordPrompt(word: string, sentence: string): string` — the only prompt format in the app.

- [ ] **Step 1: Write the failing test**

In `src/engine/speech.test.ts`, replace the existing carrier-phrase test with:
```ts
it('brackets the sentence with the capitalized word', () => {
  expect(wordPrompt('dog', 'The red dog sat.')).toBe('Dog. The red dog sat. Dog.');
});
```

Run: `npx vitest run src/engine/speech.test.ts` — Expected: FAIL (wrong arity/format).

- [ ] **Step 2: Implement in `src/engine/speech.ts`**

Replace `wordPrompt` with:
```ts
// Three-part prompt: the word alone, a context sentence, the word alone
// again. The bracketing keeps the target unambiguous even though the
// sentence contains other dictionary words; periods give the TTS pauses.
export function wordPrompt(word: string, sentence: string): string {
  const cap = word.charAt(0).toUpperCase() + word.slice(1);
  return `${cap}. ${sentence} ${cap}.`;
}
```

Run: `npx vitest run src/engine/speech.test.ts` — Expected: PASS (4 tests).

- [ ] **Step 3: Pass the sentence in `src/ui/useGame.ts`**

Both call sites change:
```ts
speaker.speak(wordPrompt(r.target.text, r.target.sentence)); // in startRound
```
```ts
if (round) speaker.speak(wordPrompt(round.target.text, round.target.sentence)); // in replay
```

- [ ] **Step 4: Update the PlayScreen test helper and format assertion**

In `src/ui/PlayScreen.test.tsx`, replace `lastSpokenTarget` with:
```ts
// The game speaks "Dog. The red dog sat. Dog." — the leading token is the target.
function lastSpokenTarget(spoken: string[]): string {
  const m = /^(\w+)\./.exec(spoken[spoken.length - 1]);
  if (!m) throw new Error(`unexpected prompt: ${spoken[spoken.length - 1]}`);
  return m[1].toLowerCase();
}
```
And replace the format assertion in the first test with:
```ts
expect(spoken[spoken.length - 1]).toMatch(/^([A-Z]\w*)\. .+\. \1\.$/);
```

- [ ] **Step 5: Verify everything**

Run: `npx vitest run` — Expected: all suites PASS.
Run: `npm run build` — Expected: green; `dist/` refreshed for the Apache vhost.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: speak a three-part sentence prompt for each round"
```

---

## Manual Verification (after Task 3)

In Chrome at the dev server (and/or `http://letterjam/` after `npm run build`):
1. Start a round — hear "Word. Sentence. Word." with natural pauses; 🔊 replays the same prompt.
2. Play several rounds — noun cards (dog, cat, sun) eventually appear as targets once introduced.
3. Confirm no round ever shows i/eye or would/wood together.

## Self-Review Notes (traceability to spec)

- **Prompt format + replay:** Task 3 (`wordPrompt`, both `useGame` call sites, exact-format test).
- **93 nouns, exclusions, lowercase christmas, length banding, noun tag:** Task 1 (list + `nounGrade` + tests).
- **i/eye, would/wood homophones:** Task 1.
- **313 sentences, provenance via parallel authoring agents:** Coordinator Pre-Step + Task 2.
- **Validator (missing/containment/edges/vocabulary/capitalization):** Task 2 Step 3; build fails on violation.
- **Inflection rules incl. e-drop, doubling, y→ies:** Task 2 `allowedForms`.
- **Word.sentence required + fixture updates:** Task 2 Steps 5–6.
- **No save migration:** nothing touches the blob; new words are introduced by existing trickle.
- **Apache dist refresh:** Task 3 Step 5 + Global Constraints.
