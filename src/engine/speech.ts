export interface Speaker {
  speak(text: string): void; // interrupts whatever is playing or queued
  queue(text: string): void; // speaks after the current utterance finishes
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

export function createSpeaker(preferredName = 'Google US English'): Speaker {
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
  // Environments without SpeechSynthesis (e.g. jsdom, older browsers) get a no-op.
  if (!synth) {
    return { speak() {}, queue() {}, cancel() {} };
  }
  let voice: SpeechSynthesisVoice | null = null;
  const refresh = () => {
    voice = pickVoice(synth.getVoices(), preferredName);
  };
  refresh();
  if (typeof synth.addEventListener === 'function') {
    synth.addEventListener('voiceschanged', refresh);
  }
  const utter = (text: string) => {
    if (!voice) refresh();
    const u = new SpeechSynthesisUtterance(text);
    if (voice) u.voice = voice;
    u.rate = 0.9;
    synth.speak(u);
  };
  return {
    speak(text: string) {
      synth.cancel();
      utter(text);
    },
    queue(text: string) {
      // SpeechSynthesis queues natively when we don't cancel first.
      utter(text);
    },
    cancel() {
      synth.cancel();
    },
  };
}
