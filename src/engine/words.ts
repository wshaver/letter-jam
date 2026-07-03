import raw from '../data/words.json';
import type { Grade, Word } from './types';

const words = raw as Word[];

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
