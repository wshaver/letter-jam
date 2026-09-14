import { expect, it } from 'vitest';
import { itemSpeech } from './speech';
import type { Item } from './gameplay';
import type { PublishedClip } from '../engine/recordedAudio';

const clip = (role: string, transcript: string): PublishedClip => ({ role, transcript,
  clip: role, asset: 'pack', url: '/coeus/lesson-media/pack/' + 'a'.repeat(64), sha256: 'a'.repeat(64),
  mime_type: 'audio/mpeg', start_seconds: 0, duration_seconds: 1, language: 'en-US' });
const letter: Item = { id: 1, type: 'letter', payload: { text: 'a', sentence: 'A is for apple.' },
  level: { title: 'Letters', position: 1 }, media: [clip('letter-name', 'A'), clip('context-sentence', 'A is for apple.')] };

it('uses explicit letter and word roles even when displayed text matches', () => {
  const media = [...letter.media!, clip('word-name', 'a')];
  expect(itemSpeech({ ...letter, media }).map(p => p.recording?.role)).toEqual(['letter-name', 'context-sentence', 'letter-name']);
  expect(itemSpeech({ ...letter, type: 'word', media }, false)[0].recording?.role).toBe('word-name');
  expect(itemSpeech({ ...letter, payload: { ...letter.payload, text: 'A' } })[0].recording).toEqual(letter.media![0]);
});

it('keeps the issued sentence and falls back for missing or mismatched recordings', () => {
  const revised = { ...letter, payload: { text: 'a', sentence: 'A different sentence.' } };
  const parts = itemSpeech(revised);
  expect(parts.map(p => p.text)).toEqual(['A.', 'A different sentence.', 'A.']);
  expect(parts[1].recording).toBeUndefined();
  expect(itemSpeech({ ...letter, media: [] }).every(p => !p.recording)).toBe(true);
  expect(itemSpeech(letter, false)).toHaveLength(1);
});
