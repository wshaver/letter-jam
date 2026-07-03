# Playtest Fixes — Design Spec

**Date:** 2026-07-03
**Status:** Approved for planning
**Source:** live playtest feedback (5-year-old on iPad)

## Problems Observed

1. On iPad, taps near cards scroll/jump the page; accidental two-finger
   touches pinch-zoom the browser; touch-drags miss the buttons.
2. Small words (i, a, am) make tiny tap targets; falling cards complicate
   aiming.
3. Rounds require tapping Next every time.
4. Difficulty ramped far too slowly for a competent 5-year-old: decoys stayed
   easy, the same six words repeated endlessly before new ones appeared.

## 1. Touch & Mobile Hardening

No third-party toolkit: modern browser capabilities replace hammer.js-era
libraries (CSS `touch-action`, `pointer: coarse` media queries, pointer
events). iOS Safari ignores `user-scalable=no`, so pinch requires an explicit
guard.

- **No scrolling:** `#root` is a fixed full-viewport container
  (`position: fixed; inset: 0; overflow: hidden`), `overscroll-behavior:
  none` on html/body. Screens that could overflow (profile list) scroll
  internally.
- **No zoom:** `touch-action: manipulation` app-wide (also removes tap
  delay); `gesturestart`/`gesturechange` preventDefault listeners in
  `main.tsx` (iOS pinch); `viewport-fit=cover` added to the viewport meta.
- **Forgiving taps:** answer cards fire on **`pointerdown`** (a tap that
  wiggles into a micro-drag still registers instantly). `user-select: none`,
  `-webkit-user-select: none`, `-webkit-touch-callout: none`,
  `-webkit-tap-highlight-color: transparent` on interactive elements.
- **Capability-based sizing:** `@media (pointer: coarse)` enlarges cards and
  buttons on touch devices (this is the "mobile detection" — capability, not
  user-agent sniffing).

## 2. Uniform Flip-Up Cards

- All answer cards are the **same fixed size** (~200×120px; larger under
  `pointer: coarse`) in a centered wrapping row — `i` gets the same tap
  target as `together`.
- Long words (≥7 chars) get a smaller font via a `long` class; letter glyphs
  keep their large size within the fixed card.
- The falling animation is **removed** (keyframes deleted, per-card delays
  deleted). Cards **flip up simultaneously** (rotateX 90°→0, ~0.35s,
  transform-origin bottom), disabled under `prefers-reduced-motion`.

## 3. Auto-Advance + Big Next

- When a round resolves (win or oneAndDone miss — the reveal glow gets the
  same viewing window), a **3-second countdown** displays on the Next button
  ("Next (3)" → "(2)" → "(1)") and then auto-advances. Tapping Next early
  advances immediately. The timer cancels on unmount (mode/profile switch).
- Next becomes a large touch target (~72px tall, wide), bigger still under
  `pointer: coarse`.

## 4. Difficulty Ramp

- **Nearness rises on every correct-first-try:** `decoyNearness + 0.1` per
  correct answer (cap 0.8) — no longer gated on box ≥ 4. Values round to one
  decimal so saved blobs stay tidy.
- **choiceCount is unchanged:** still +1 when a correct answer lands the word
  in box ≥ 4 (cap 5).
- **Miss relief rebalanced:** 2 consecutive misses → `decoyNearness − 0.3`
  (floor 0) and `choiceCount − 1` (floor 3); streak resets as before. Box
  drop (−2, floor 1) unchanged.
- **Trickle trigger becomes "box 1 is empty":** new words (batch of 3,
  unchanged) introduce as soon as **no introduced word in the active pool is
  in box 1**. Replaces the "60% of introduced words at box ≥ 4" threshold;
  `SessionConfig` drops `trickleThreshold`/`masteredBox`. A miss (word back
  to box 1) naturally pauses introduction until re-won. Applies to both word
  and letters modes (shared session logic). Initial batch stays 6.

## What Doesn't Change

Leitner box rules, celebration tiers, prompts/audio, homophone/case guards,
storage format (WordState fields unchanged — only stepping rules change),
letter mode structure.

## Testing

- Engine: rewritten leitner difficulty tests (per-correct nearness, new ease
  values), session trickle tests (box-1-empty trigger).
- UI: countdown/auto-advance with fake timers; pointerdown taps (userEvent
  dispatches pointer events, so existing click-based tests keep working);
  card sizing classes.
- Physical iPad feel (pinch, drag, target sizes) verified by hand after
  merge.

## Risks / Decisions

1. `pointerdown` answers faster but is less forgiving of a changed mind
   mid-press — accepted: little fingers benefit more than deliberate
   pressers lose.
2. +0.1/correct means ~8 wins to max nearness per word — tunable constants.
3. Box-1-empty trickle is much faster than before; if it floods, the batch
   size (3) is the brake to tune.
