import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { PlayScreen } from './PlayScreen';
import { createProfile } from '../engine/profiles';
import { newWordState } from '../engine/leitner';
import type { Profile, Word } from '../engine/types';
import type { Rng } from '../engine/random';

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

const W = (id: string): Word => ({ id, text: id, grade: 'preK', length: id.length, sentence: `We can see the ${id} now.` });
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

// The game speaks "Dog. The red dog sat. Dog." — the leading token is the target.
function lastSpokenTarget(spoken: string[]): string {
  const m = /^(\w+)\./.exec(spoken[spoken.length - 1]);
  if (!m) throw new Error(`unexpected prompt: ${spoken[spoken.length - 1]}`);
  return m[1].toLowerCase();
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

it('speaks the three-part prompt and celebrates a first-try correct tap', async () => {
  const user = userEvent.setup();
  const { spoken, speaker } = fakeSpeaker();
  render(<PlayScreen profile={makeProfile()} onProfileChange={() => {}} words={WORDS} speaker={speaker} rng={seeded(1)} />);
  expect(spoken[spoken.length - 1]).toMatch(/^([A-Z]\w*)\. .+\. \1\.$/);

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

it('sizes the whole round by its longest word (no font-size tell)', () => {
  const { speaker } = fakeSpeaker();
  const make = (ids: string[]) => {
    const pool = ids.map(W);
    const p = createProfile('id', 'A', '🦄');
    for (const w of pool) p.progress.words[w.id] = newWordState();
    return render(<PlayScreen profile={p} onProfileChange={() => {}} words={pool} speaker={speaker} rng={seeded(1)} />);
  };
  // All-short pool: no card may have the long class.
  const short = make(['cat', 'dog', 'sun', 'run', 'big']);
  expect(document.querySelectorAll('.card').length).toBeGreaterThan(0);
  expect(document.querySelector('.card.long')).toBeNull();
  short.unmount();
  // Mixed 3-word pool (choiceCount 3 renders ALL of them): the short word
  // must inherit the long size — a bigger font would reveal the answer.
  const mixed = make(['go', 'squirrel', 'because']);
  const mixedCards = [...document.querySelectorAll('.card')];
  expect(mixedCards).toHaveLength(3);
  expect(mixedCards.every((c) => c.classList.contains('long'))).toBe(true);
  mixed.unmount();
  // All-long pool: every rendered card has it.
  make(['together', 'because', 'morning', 'picture', 'children']);
  const cards = [...document.querySelectorAll('.card')];
  expect(cards.length).toBeGreaterThan(0);
  expect(cards.every((c) => c.classList.contains('long'))).toBe(true);
});

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

it('briefly ignores card taps after an auto-advance', async () => {
  vi.useFakeTimers();
  try {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { spoken, speaker } = fakeSpeaker();
    const onProfileChange = vi.fn();
    render(<PlayScreen profile={makeProfile()} onProfileChange={onProfileChange} words={WORDS} speaker={speaker} rng={seeded(1)} />);
    await user.click(screen.getByRole('button', { name: lastSpokenTarget(spoken) }));
    await act(async () => { vi.advanceTimersByTime(3100); }); // auto-advance to round 2
    expect(spoken.length).toBe(2);
    const callsAfterAdvance = onProfileChange.mock.calls.length;
    await user.click(screen.getByRole('button', { name: lastSpokenTarget(spoken) }));
    expect(onProfileChange.mock.calls.length).toBe(callsAfterAdvance); // locked
    await act(async () => { vi.advanceTimersByTime(500); });
    await user.click(screen.getByRole('button', { name: lastSpokenTarget(spoken) }));
    expect(onProfileChange.mock.calls.length).toBe(callsAfterAdvance + 1); // unlocked
  } finally {
    vi.useRealTimers();
  }
});
