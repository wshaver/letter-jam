import raw from '../data/words.json';
import type { Grade, Word } from './types';
import audio from '../data/audio.json';

const phrases: Record<string, { text: string }> = audio.clips;
const words: Word[] = (raw as Word[]).map(word => {
  const phrase = word.tags?.includes('letter') && phrases[`pair-${word.text.toLowerCase()}`];
  return phrase ? { ...word, sentence: phrase.text } : word;
});

export function allWords(): Word[] {
  return words;
}

export function wordsByGrade(grade: Grade): Word[] {
  return words.filter((w) => w.grade === grade);
}

export function wordById(id: string): Word | undefined {
  return words.find((w) => w.id === id);
}

export function wordsForMode(mode: 'words' | 'letters'): Word[] {
  return words.filter((w) => (w.tags?.includes('letter') ?? false) === (mode === 'letters'));
}
