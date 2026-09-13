import { playRecording, speechParts, type SpeechMode } from './recordedAudio';

export interface Speaker {
  speak(text: string, mode?: SpeechMode): void; // interrupts whatever is playing or queued
  queue(text: string, mode?: SpeechMode): void; // speaks after the current utterance finishes
  cancel(): void;
}

// Three-part prompt: the word alone, a context sentence, the word alone
// again. The bracketing keeps the target unambiguous even though the
// sentence contains other dictionary words; periods give the TTS pauses.
export function wordPrompt(word: string, sentence: string): string {
  const cap = word.charAt(0).toUpperCase() + word.slice(1);
  return `${cap}. ${sentence} ${cap}.`;
}

// A word spoken by itself, e.g. after a wrong tap ("Together.").
export function wordAlone(word: string): string {
  const cap = word.charAt(0).toUpperCase() + word.slice(1);
  return `${cap}.`;
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

export function createSpeaker(preferredName = 'Google US English', recordings = true): Speaker {
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
  let pending: { text: string; id?: string }[] = [];
  let active = false;
  let generation = 0;
  let stop: (() => void) | undefined;
  const next = () => {
    if (active) return;
    const part = pending.shift();
    if (!part) return;
    active = true;
    const ticket = generation;
    let finished = false;
    let usingFallback = false;
    const done = () => {
      if (ticket !== generation || finished) return;
      finished = true;
      active = false; stop = undefined; next();
    };
    const fallback = () => {
      if (ticket !== generation) return;
      usingFallback = true;
      if (!synth) { done(); return; }
      utter(part.text, done);
    };
    if (part.id) {
      try {
        const cancelRecording = playRecording(part.id, done, fallback);
        if (!finished && !usingFallback) stop = cancelRecording;
      }
      catch { fallback(); }
    } else fallback();
  };
  const utter = (text: string, done: () => void) => {
    if (!synth) { done(); return; }
    const u = new SpeechSynthesisUtterance(text);
    const voice = pickVoice(synth.getVoices(), preferredName);
    if (voice) u.voice = voice;
    u.rate = 0.9;
    u.onend = done;
    u.onerror = done;
    stop = () => { u.onend = null; u.onerror = null; };
    try { synth.speak(u); } catch { done(); }
  };
  const cancel = () => {
    generation++;
    pending = [];
    stop?.(); stop = undefined;
    active = false;
    synth?.cancel();
  };
  return {
    speak(text, mode = 'words') {
      cancel();
      pending.push(...(recordings ? speechParts(text, mode) : [{ text }]));
      next();
    },
    queue(text, mode = 'words') {
      pending.push(...(recordings ? speechParts(text, mode) : [{ text }]));
      next();
    },
    cancel,
  };
}
