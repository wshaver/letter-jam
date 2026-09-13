import { Howl, Howler } from 'howler';
import audio from '../data/audio.json';

export type SpeechMode = 'words' | 'letters';
export type Clip = { file: string; start: number; duration: number; text: string };
export const clips: Record<string, Clip> = audio.clips;
// The existing dictionary spells "don't" as "dont"; both use the same take.
const normalize = (text: string) => text.trim().replace(/[.!?]+$/, '').replace(/['’]/g, '').toLowerCase();
const lookup = { words: new Map<string, string>(), letters: new Map<string, string>() };
for (const [id, clip] of Object.entries(clips)) {
  const mode = id.startsWith('word-') ? 'words' : 'letters';
  lookup[mode].set(normalize(clip.text), id);
}

export function speechParts(text: string, mode: SpeechMode): { text: string; id?: string }[] {
  const exact = lookup[mode].get(normalize(text));
  if (exact) return [{ text, id: exact }];
  const parts = (text.match(/[^.!?]+[.!?]*/g) ?? []).map(text => ({
    text: text.trim(), id: lookup[mode].get(normalize(text)),
  }));
  // Preserve natural sentence flow when the whole prompt uses device speech.
  return parts.some(part => part.id) ? parts : [{ text }];
}

const players = new Map<string, Howl>();
export function unlockRecordedAudio(): void {
  try {
    // Create the shared context during the first tap, before React's game effect.
    if (!Howler.ctx) getPlayer(Object.values(clips)[0]);
    void Howler.ctx?.resume().catch(() => {});
  } catch { /* unavailable */ }
}

function getPlayer(clip: Clip): Howl {
  let howl = players.get(clip.file);
  if (!howl) {
    const sprite: Record<string, [number, number]> = {};
    for (const [key, item] of Object.entries(clips)) {
      if (item.file === clip.file) sprite[key] = [item.start * 1000, item.duration * 1000];
    }
    howl = new Howl({ src: [new URL(clip.file, document.baseURI).href], sprite, preload: false });
    players.set(clip.file, howl);
  }
  return howl;
}

// Returns a cancellation function; completion and errors are mutually exclusive.
export function playRecording(id: string, done: () => void, failed: () => void): () => void {
  const clip = clips[id];
  const player = getPlayer(clip);
  let soundId: number | undefined;
  let settled = false;
  let timer: ReturnType<typeof setTimeout>;
  const cleanup = () => {
    clearTimeout(timer);
    player.off('load', start);
    player.off('loaderror', error);
    player.off('playerror', error, soundId);
    player.off('end', end, soundId);
  };
  const end = () => {
    if (settled) return;
    settled = true; cleanup(); done();
  };
  const error = () => {
    if (settled) return;
    settled = true; cleanup();
    if (soundId !== undefined) player.stop(soundId);
    failed();
  };
  const start = () => {
    if (settled) return;
    try {
      soundId = player.play(id);
      player.once('end', end, soundId);
      player.once('playerror', error, soundId);
      clearTimeout(timer);
      timer = setTimeout(error, clip.duration * 1000 + 8000);
    } catch { error(); }
  };
  timer = setTimeout(error, 8000);
  player.once('loaderror', error);
  unlockRecordedAudio();
  if (player.state() === 'loaded') start();
  else {
    player.once('load', start);
    if (player.state() === 'unloaded') player.load();
  }
  return () => {
    settled = true; cleanup();
    if (soundId !== undefined) player.stop(soundId);
  };
}
