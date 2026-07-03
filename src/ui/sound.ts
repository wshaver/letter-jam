// A single shared AudioContext. iOS Safari starts one in the "suspended"
// state and only unlocks it when resume() is called synchronously inside a
// user gesture — and it caps the number of contexts you may create — so we
// reuse one and unlock it on the first tap (see unlockAudio + main.tsx).
let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!ctx) {
    try {
      ctx = new Ctx();
    } catch {
      return null;
    }
  }
  return ctx;
}

// Call from the first user gesture (pointer/touch) so later chimes — fired
// from effects, outside a gesture — actually play on iOS.
export function unlockAudio(): void {
  const c = getCtx();
  if (c && c.state === 'suspended') void c.resume();
}

export function playChime(level: 'big' | 'small'): void {
  try {
    const c = getCtx();
    if (!c) return;
    if (c.state === 'suspended') void c.resume(); // best effort if not yet unlocked
    const notes = level === 'big' ? [523, 659, 784] : [523, 659];
    notes.forEach((f, i) => {
      const o = c.createOscillator();
      const g = c.createGain();
      o.frequency.value = f;
      o.connect(g);
      g.connect(c.destination);
      const t = c.currentTime + i * 0.12;
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
