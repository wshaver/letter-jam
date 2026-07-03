# Playtest Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix iPad touch problems (scroll/zoom/drag), replace falling cards with uniform flip-up cards, auto-advance rounds with a countdown on a big Next button, and speed up the difficulty ramp (nearness per correct answer; box-1-empty trickle).

**Architecture:** Engine changes are pure-function updates to `leitner.ts` (per-correct nearness stepping) and `session.ts` (box-1-empty trickle trigger, simplified config). UI changes live in `PlayScreen.tsx` (pointerdown, countdown) and `index.css` (fixed-size flip cards, touch hardening); `main.tsx` gains iOS pinch guards.

**Tech Stack:** unchanged. No new dependencies (CSS `touch-action` + `pointer: coarse` + pointer events replace mobile-toolkit libraries).

## Global Constraints

- **Nearness stepping:** `decoyNearness + 0.1` on EVERY correct-first-try (cap 0.8); values rounded to 1 decimal. `choiceCount` still +1 only when the correct answer lands the word in box ≥ 4 (cap 5). Ease (2 consecutive misses): nearness −0.3 (floor 0), choiceCount −1 (floor 3), streak resets. Box rules unchanged (+1 / −2 floor 1).
- **Trickle:** introduce `trickleBatch` (3) new words when NO introduced pool word has `box === 1`. `SessionConfig` becomes `{ initialBatch: 6, trickleBatch: 3 }` — `trickleThreshold` and `masteredBox` are DELETED.
- **Cards:** fixed size 200×120px (220×140 under `pointer: coarse`), centered wrapping row, simultaneous `flipup` animation (rotateX 90°→0, 0.35s, transform-origin bottom), none under `prefers-reduced-motion`. Falling animation and per-card `animationDelay` deleted. Words with `text.length >= 7` get class `long` (smaller font); 1-char cards keep `glyph`.
- **Answer taps fire on `pointerdown`** (cards only; Next/speaker stay onClick).
- **Auto-advance:** on `status !== 'playing'`, Next shows `Next (3)` → `(2)` → `(1)`, auto-calls `next()` when the countdown passes 0; interval cleared on unmount and on early tap.
- **Touch hardening:** `#root` fixed fullscreen no-overflow; `overscroll-behavior: none`; `touch-action: manipulation`; text-selection/callout/tap-highlight suppressed; `gesturestart`/`gesturechange` preventDefault in `main.tsx`; `viewport-fit=cover` in index.html.
- TypeScript strict; full suite + `npm run build` green at each task's commit; `npm run build` after final merge (Apache vhost serves dist/).

---

### Task 1: Difficulty ramp — leitner + session

**Files:**
- Modify: `src/engine/leitner.ts`, `src/engine/session.ts`
- Test: `src/engine/leitner.test.ts`, `src/engine/session.test.ts`

**Interfaces:**
- Produces: `NEARNESS_STEP_UP = 0.1`, `NEARNESS_STEP_DOWN = 0.3` (replacing `NEARNESS_STEP = 0.4`); `SessionConfig { initialBatch: number; trickleBatch: number }`; `DEFAULT_SESSION_CONFIG = { initialBatch: 6, trickleBatch: 3 }`. `recordResult`/`introduceIfNeeded` signatures unchanged.

- [ ] **Step 1: Rewrite the difficulty tests**

In `src/engine/leitner.test.ts`, replace the tests `'difficulty steps up on reaching box 4 and again at box 5, then caps'` and `'two misses in a row step difficulty down and reset the streak'` with:

```ts
it('nearness rises 0.1 on every correct; choiceCount still steps at box >= 4', () => {
  let s = newWordState();
  s = recordResult(s, true); // box 2
  expect(s.decoyNearness).toBeCloseTo(0.1);
  expect(s.choiceCount).toBe(MIN_CHOICES);
  s = recordResult(s, true); // box 3
  expect(s.decoyNearness).toBeCloseTo(0.2);
  expect(s.choiceCount).toBe(MIN_CHOICES);
  s = recordResult(s, true); // box 4 -> choiceCount steps
  expect(s.decoyNearness).toBeCloseTo(0.3);
  expect(s.choiceCount).toBe(4);
  s = recordResult(s, true); // box 5
  expect(s.decoyNearness).toBeCloseTo(0.4);
  expect(s.choiceCount).toBe(MAX_CHOICES);
  for (let i = 0; i < 10; i++) s = recordResult(s, true);
  expect(s.decoyNearness).toBe(MAX_NEARNESS); // capped, clean 1-decimal value
  expect(s.choiceCount).toBe(MAX_CHOICES);
});

it('two misses in a row ease difficulty and reset the streak', () => {
  let s: WordState = { ...newWordState(), box: 5, choiceCount: 5, decoyNearness: 0.8 };
  s = recordResult(s, false);
  expect(s.missStreak).toBe(1);
  expect(s.decoyNearness).toBeCloseTo(0.8); // single miss does not ease
  s = recordResult(s, false);
  expect(s.decoyNearness).toBeCloseTo(0.5); // -0.3
  expect(s.choiceCount).toBe(4);
  expect(s.missStreak).toBe(0);
});
```

Keep all other leitner tests unchanged (start-easy, box clamping, miss drop, streak reset on correct, floors, boxWeight). The floors test still passes (easing from 0 stays 0).

Run: `npx vitest run src/engine/leitner.test.ts` — Expected: FAIL.

- [ ] **Step 2: Implement in `src/engine/leitner.ts`**

Replace the constants `NEARNESS_STEP = 0.4` with:
```ts
export const NEARNESS_STEP_UP = 0.1; // nearness rises on every correct answer
export const NEARNESS_STEP_DOWN = 0.3; // relief after 2 consecutive misses
```
Add a rounding helper and update `recordResult`:
```ts
const round1 = (n: number) => Math.round(n * 10) / 10;

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
      decoyNearness: round1(Math.min(state.decoyNearness + NEARNESS_STEP_UP, MAX_NEARNESS)),
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
    decoyNearness: ease ? round1(Math.max(state.decoyNearness - NEARNESS_STEP_DOWN, 0)) : state.decoyNearness,
    missStreak: ease ? 0 : missStreak,
  };
}
```

Run: `npx vitest run src/engine/leitner.test.ts` — Expected: PASS (8 tests).

- [ ] **Step 3: Rewrite the trickle tests**

In `src/engine/session.test.ts`, replace `'does not introduce more until the mastery threshold is met'` and `'trickles in more words once enough are mastered'` with:

```ts
it('does not introduce more while any pool word sits in box 1', () => {
  const p0 = introduceIfNeeded(createProfile('id', 'A', '🦄'), WORDS);
  const before = Object.keys(p0.progress.words).length;
  const p1 = introduceIfNeeded(p0, WORDS); // all still box 1
  expect(Object.keys(p1.progress.words).length).toBe(before);
});

it('trickles in more words as soon as box 1 is empty', () => {
  let p = introduceIfNeeded(createProfile('id', 'A', '🦄'), WORDS);
  for (const id of Object.keys(p.progress.words)) p.progress.words[id].box = 2;
  const before = Object.keys(p.progress.words).length;
  p = introduceIfNeeded(p, WORDS);
  expect(Object.keys(p.progress.words).length).toBe(before + DEFAULT_SESSION_CONFIG.trickleBatch);
});

it('a single word back in box 1 pauses introduction', () => {
  let p = introduceIfNeeded(createProfile('id', 'A', '🦄'), WORDS);
  const ids = Object.keys(p.progress.words);
  for (const id of ids) p.progress.words[id].box = 3;
  p.progress.words[ids[0]].box = 1; // one missed word
  const before = Object.keys(p.progress.words).length;
  p = introduceIfNeeded(p, WORDS);
  expect(Object.keys(p.progress.words).length).toBe(before);
});
```

The pool-scoping test from letter mode stays unchanged.

Run: `npx vitest run src/engine/session.test.ts` — Expected: FAIL.

- [ ] **Step 4: Implement in `src/engine/session.ts`**

Replace `SessionConfig` and `DEFAULT_SESSION_CONFIG`:
```ts
export interface SessionConfig {
  initialBatch: number;
  trickleBatch: number;
}

export const DEFAULT_SESSION_CONFIG: SessionConfig = {
  initialBatch: 6,
  trickleBatch: 3,
};
```
(Remove the now-unused `Box` import if it becomes unused.)

In `introduceIfNeeded`, replace the else-branch trickle logic:
```ts
  } else {
    // Trickle as soon as box 1 is empty: every introduced pool word has been
    // answered at least once since it last missed.
    const anyInBoxOne = introducedIds.some((id) => state[id].box === 1);
    if (!anyInBoxOne) {
      toIntroduce = ordered.filter((w) => !state[w.id]?.introduced).slice(0, config.trickleBatch);
    }
  }
```

Run: `npx vitest run src/engine/session.test.ts` — Expected: PASS (5 tests).

- [ ] **Step 5: Full verify + commit**

Run: `npx vitest run` and `npm run build` — Expected: green.
```bash
git add -A
git commit -m "feat: faster difficulty ramp - nearness per correct, box-1-empty trickle"
```

---

### Task 2: Uniform flip-up cards + touch hardening

**Files:**
- Modify: `src/ui/PlayScreen.tsx`, `src/index.css` (restructure card styles), `src/main.tsx`, `index.html`
- Test: `src/ui/PlayScreen.test.tsx` (one addition)

**Interfaces:**
- Consumes: nothing new. Produces: cards fire `choose` on pointerdown; class contract `card [glyph|long] [faded] [reveal]`.

- [ ] **Step 1: Write the failing test**

Append to `src/ui/PlayScreen.test.tsx`:
```tsx
it('gives long words the long class for smaller text', async () => {
  const { speaker } = fakeSpeaker();
  const longWords = ['together', 'because', 'always', 'cat', 'dog', 'sun'].map(W);
  const p = createProfile('id', 'A', '🦄');
  for (const w of longWords) p.progress.words[w.id] = newWordState();
  render(<PlayScreen profile={p} onProfileChange={() => {}} words={longWords} speaker={speaker} rng={seeded(1)} />);
  for (const card of document.querySelectorAll('.card')) {
    const text = card.textContent ?? '';
    expect(card.className.includes('long'), text).toBe(text.length >= 7);
  }
});
```

Run: `npx vitest run src/ui/PlayScreen.test.tsx` — Expected: FAIL (no `long` class).

- [ ] **Step 2: Update `src/ui/PlayScreen.tsx`**

Card rendering becomes (pointerdown + class buckets, no animationDelay):
```tsx
        {round.choices.map((w) => {
          const reveal = status === 'missed' && w.id === round.target.id;
          const size = w.text.length === 1 ? 'glyph' : w.text.length >= 7 ? 'long' : '';
          return (
            <button
              key={w.id}
              className={`card ${size} ${wrongIds.has(w.id) ? 'faded' : ''} ${reveal ? 'reveal' : ''}`}
              disabled={wrongIds.has(w.id) || status !== 'playing'}
              onPointerDown={() => choose(w)}
            >
              {w.text}
            </button>
          );
        })}
```

- [ ] **Step 3: Restructure card + touch CSS in `src/index.css`**

REPLACE the existing `.cards`/`.card`/`@keyframes fall` block (keep `.faded`, `.reveal` semantics) with:

```css
.cards { display: flex; flex-wrap: wrap; gap: 1rem; justify-content: center; max-width: 760px; }
.card {
  width: 200px; height: 120px;
  display: flex; align-items: center; justify-content: center;
  font-size: 2.4rem; border-radius: 1rem;
  border: 4px solid #7cc; background: #fff; cursor: pointer;
  transition: opacity 0.6s ease;
  /* All cards flip up together — same size, same moment. */
  animation: flipup 0.35s ease-out;
  transform-origin: bottom;
}
.card.long { font-size: 1.7rem; }
.card.glyph { font-size: 4rem; line-height: 1; }
.card.faded { opacity: 0; pointer-events: none; }
.card.reveal { border-color: #fc3; box-shadow: 0 0 20px #fc3; }
@keyframes flipup {
  from { transform: rotateX(90deg); opacity: 0.3; }
  to { transform: rotateX(0); opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
  .card { animation: none; }
}
@media (pointer: coarse) {
  .card { width: 220px; height: 140px; }
}
```

And APPEND the touch-hardening block:
```css
/* --- touch hardening (iPad: no scroll, no zoom, no accidental selection) --- */
html, body { overscroll-behavior: none; height: 100%; }
#root { position: fixed; inset: 0; overflow: hidden; display: flex; flex-direction: column; }
#root > * { overflow-y: auto; }
* { -webkit-tap-highlight-color: transparent; }
button, .card {
  touch-action: manipulation;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
}
body { touch-action: manipulation; }
```

- [ ] **Step 4: iOS pinch guards in `src/main.tsx`**

After the imports, before `createRoot`:
```ts
// iOS Safari ignores user-scalable=no; block pinch-zoom explicitly.
for (const evt of ['gesturestart', 'gesturechange']) {
  document.addEventListener(evt, (e) => e.preventDefault());
}
```

- [ ] **Step 5: Viewport meta in `index.html`**

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
```

- [ ] **Step 6: Verify + commit**

Run: `npx vitest run` — Expected: all green (userEvent.click dispatches pointerdown, so existing card-tap tests keep passing).
Run: `npm run build` — Expected: green.
```bash
git add -A
git commit -m "feat: uniform flip-up cards and iPad touch hardening"
```

---

### Task 3: Auto-advance countdown + big Next

**Files:**
- Modify: `src/ui/PlayScreen.tsx`, `src/index.css` (append)
- Test: `src/ui/PlayScreen.test.tsx`

**Interfaces:**
- Consumes: `next()` from useGame (unchanged). No new exports.

- [ ] **Step 1: Write the failing test**

Append to `src/ui/PlayScreen.test.tsx` (import `act` from `@testing-library/react` if not present):
```tsx
it('auto-advances three seconds after a round resolves', async () => {
  vi.useFakeTimers();
  try {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { spoken, speaker } = fakeSpeaker();
    render(<PlayScreen profile={makeProfile()} onProfileChange={() => {}} words={WORDS} speaker={speaker} rng={seeded(1)} />);
    const target = lastSpokenTarget(spoken);
    await user.click(screen.getByRole('button', { name: target }));
    expect(screen.getByRole('button', { name: /next \(3\)/i })).toBeInTheDocument();
    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(screen.getByRole('button', { name: /next \(2\)/i })).toBeInTheDocument();
    await act(async () => { vi.advanceTimersByTime(2100); });
    expect(spoken.length).toBe(2); // next round spoke automatically
  } finally {
    vi.useRealTimers();
  }
});
```

Run: `npx vitest run src/ui/PlayScreen.test.tsx` — Expected: FAIL.

- [ ] **Step 2: Implement the countdown in `src/ui/PlayScreen.tsx`**

Add near the top of the component (imports: `useEffect, useState` from react):
```tsx
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    if (status === 'playing') return;
    setCountdown(3);
    const id = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(id);
  }, [status]);

  useEffect(() => {
    if (status !== 'playing' && countdown <= 0) next();
  }, [countdown, status, next]);
```
And the Next button becomes:
```tsx
          <button className="next" onClick={next}>
            Next ({Math.max(countdown, 0)})
          </button>
```

Note: `next` comes from `useGame` — it is `startRound`, a stable-enough `useCallback`; including it in the deps array is correct.

- [ ] **Step 3: Big Next CSS (append to `src/index.css`)**

```css
.next { min-height: 72px; font-size: 2rem; padding: 1rem 4rem; border-radius: 1rem; width: min(90vw, 420px); }
@media (pointer: coarse) {
  .next { min-height: 84px; font-size: 2.4rem; }
}
```

- [ ] **Step 4: Verify + commit**

Run: `npx vitest run src/ui/PlayScreen.test.tsx` — Expected: PASS (5 tests).
Run: `npx vitest run` and `npm run build` — Expected: green.
```bash
git add -A
git commit -m "feat: auto-advance countdown on a big Next button"
```

---

## Manual Verification (after Task 3 — on the iPad!)

1. Pinch/two-finger touches don't zoom; drags don't scroll; taps register even with a wiggle.
2. All cards identical size, flip up together; small words easy to hit.
3. Win → confetti → "Next (3)(2)(1)" → auto-advances; tapping big Next skips ahead.
4. Play 7+ rounds with a fresh profile: after all six starters are won once, three new words appear immediately; decoys visibly harden every few wins.

## Self-Review Notes (traceability to spec)

- **Nearness per correct + rebalanced ease + rounding:** Task 1 (leitner).
- **Box-1-empty trickle + config simplification:** Task 1 (session).
- **Fixed-size flip-up cards, falling deleted, long/glyph classes:** Task 2.
- **pointerdown answers, no-scroll/no-zoom/no-selection, iOS pinch guards, viewport-fit:** Task 2.
- **`pointer: coarse` sizing:** Tasks 2 & 3 CSS.
- **3s countdown auto-advance on win AND miss (status !== 'playing'), early-tap skip, cleanup on unmount:** Task 3.
- **No storage/format changes:** WordState fields unchanged; old blobs work.
