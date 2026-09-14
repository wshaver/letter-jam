import type { Item } from './gameplay';
import { wordAlone, type SpeechPart } from '../engine/speech';

export function itemSpeech(item: Item, context = true): SpeechPart[] {
  const media = Array.isArray(item.media) ? item.media : [];
  const name = { text: wordAlone(item.payload.text),
    recording: media.find(clip => clip?.role === (item.type === 'letter' ? 'letter-name' : 'word-name')) };
  if (!context || !item.payload.sentence) return [name];
  const sentence = { text: item.payload.sentence,
    recording: media.find(clip => clip?.role === 'context-sentence' && clip.transcript === item.payload.sentence) };
  return [name, sentence, name];
}
