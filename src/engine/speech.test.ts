import { pickVoice, wordAlone, wordPrompt } from './speech';

const v = (name: string, lang: string) => ({ name, lang }) as SpeechSynthesisVoice;

it('prefers the exact named voice', () => {
  const voices = [v('Alex', 'en-US'), v('Google US English', 'en-US')];
  expect(pickVoice(voices, 'Google US English')?.name).toBe('Google US English');
});

it('falls back to any English voice', () => {
  const voices = [v('Klara', 'de-DE'), v('Daniel', 'en-GB')];
  expect(pickVoice(voices, 'Google US English')?.lang).toBe('en-GB');
});

it('returns null when there are no voices', () => {
  expect(pickVoice([], 'Google US English')).toBeNull();
});

it('brackets the sentence with the capitalized word', () => {
  expect(wordPrompt('dog', 'The red dog sat.')).toBe('Dog. The red dog sat. Dog.');
});

it('speaks a word alone with capitalization and a period', () => {
  expect(wordAlone('together')).toBe('Together.');
  expect(wordAlone('a')).toBe('A.');
});
