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
  if (!c) return;
  if (c.state === 'suspended') void c.resume();
  // iOS only accepts a *real* audio start inside a gesture — a 1-sample silent
  // buffer is not enough. A brief, effectively inaudible oscillator burst
  // activates the context so later programmatic chimes play.
  try {
    const o = c.createOscillator();
    const g = c.createGain();
    g.gain.value = 0.0001;
    o.frequency.value = 440;
    o.connect(g);
    g.connect(c.destination);
    o.start();
    o.stop(c.currentTime + 0.15);
  } catch {
    // oscillator not supported here — resume() above is the fallback
  }
}

// Re-activate the context from within a user gesture (e.g. the winning tap).
export function resumeAudio(): void {
  const c = getCtx();
  if (c && c.state === 'suspended') void c.resume();
}

// Diagnostic: play the chime inside a direct gesture and report the context
// state, so we can tell "Web Audio dead on this device" from "chime fired
// outside a gesture on a re-suspended context."
export function soundDiagnostic(): string {
  const c = getCtx();
  if (!c) return 'no AudioContext on this browser';
  const before = c.state;
  try {
    void c.resume();
    playChime('big');
    return `ctx ${before}→${c.state} · ${Math.round(c.sampleRate)}Hz · played ok`;
  } catch (err) {
    return `ctx ${before} · error: ${(err as Error).message}`;
  }
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
      // Triangle reads louder than a pure sine at the same gain; a higher peak
      // brings the chime up near the speech volume.
      o.type = 'triangle';
      o.frequency.value = f;
      o.connect(g);
      g.connect(c.destination);
      const t = c.currentTime + i * 0.12;
      g.gain.setValueAtTime(0.001, t);
      g.gain.exponentialRampToValueAtTime(0.5, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      o.start(t);
      o.stop(t + 0.19);
    });
  } catch {
    // audio not available in this environment
  }
}
