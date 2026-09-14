import { vi, beforeEach, afterEach, expect, it } from 'vitest';
const mock = vi.hoisted(() => ({ players: [] as any[] }));
vi.mock('howler', () => ({
  Howler: { ctx: { resume: () => Promise.resolve() } },
  Howl: class {
    events: { event: string; fn: () => void; id?: number }[] = [];
    loaded = false;
    options: any;
    play = vi.fn(() => 7);
    stop = vi.fn();
    unload = vi.fn();
    load = vi.fn();
    constructor(options: any) { this.options = options; mock.players.push(this); }
    state() { return this.loaded ? 'loaded' : 'unloaded'; }
    once(event: string, fn: () => void, id?: number) { this.events.push({ event, fn, id }); }
    off(event: string, fn: () => void, id?: number) {
      this.events = this.events.filter(e => !(e.event === event && e.fn === fn && (id === undefined || id === e.id)));
    }
    emit(event: string) {
      if (event === 'load') this.loaded = true;
      for (const e of this.events.filter(e => e.event === event)) { this.off(e.event, e.fn, e.id); e.fn(); }
    }
  },
}));

import { clips, speechParts, playRecording, playPublishedRecording, type PublishedClip } from './recordedAudio';
import { createSpeaker, wordPrompt } from './speech';
let utterances: any[];
beforeEach(() => {
  vi.useFakeTimers();
  utterances = [];
  vi.stubGlobal('SpeechSynthesisUtterance', class { constructor(public text: string) {} });
  vi.stubGlobal('speechSynthesis', { getVoices: () => [], speak: (u: any) => utterances.push(u), cancel: vi.fn() });
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });
const latest = () => mock.players[mock.players.length - 1];
const playerFor = (id: string) => mock.players.find(p => p.options.sprite[id]);

it('uses letter names separately from the sight words A and I', () => {
  expect(speechParts('A.', 'letters')[0].id).toBe('name-a');
  expect(speechParts('A.', 'words')[0].id).toBe('word-a');
  expect(speechParts('I.', 'words')[0].id).toBe('word-i');
  expect(speechParts('Dont.', 'words')[0].id).toBe('word-dont');
  expect(speechParts('X. X is for xylophone. X.', 'letters').map(p => p.id)).toEqual(['name-x', 'pair-x', 'name-x']);
});

it('keeps unrecorded context sentences intact between recorded words', () => {
  expect(speechParts(wordPrompt('red', 'The red dog sat.'), 'words').map(p => p.id)).toEqual(['word-red', undefined, 'word-red']);
  expect(speechParts('Unrecorded. An unrecorded sentence. Unrecorded.', 'words')).toHaveLength(1);
});

it('uses millisecond sprite offsets and a subdirectory-safe asset URL', () => {
  const stop = playRecording('name-a', vi.fn(), vi.fn());
  const player = latest();
  expect(player.options.sprite['name-a']).toEqual([clips['name-a'].start * 1000, clips['name-a'].duration * 1000]);
  expect(player.options.src[0]).toBe(new URL(clips['name-a'].file, document.baseURI).href);
  stop();
  player.emit('load');
  expect(player.play).not.toHaveBeenCalled();
});

it('sequences wrong answer, target, device sentence, target without overlap', () => {
  const speaker = createSpeaker();
  speaker.speak('Cat.');
  speaker.queue(wordPrompt('red', 'The red dog sat.'));
  const cat = playerFor('word-cat'); cat.emit('load');
  expect(cat.play).toHaveBeenLastCalledWith('word-cat');
  expect(utterances).toHaveLength(0);
  cat.emit('end');
  const dog = playerFor('word-red'); dog.emit('load');
  expect(dog.play).toHaveBeenLastCalledWith('word-red');
  dog.emit('end');
  expect(utterances.map(u => u.text)).toEqual(['The red dog sat.']);
  utterances[0].onend();
  expect(dog.play).toHaveBeenLastCalledWith('word-red');
  speaker.cancel();
});

it('falls back on playback errors and cancels the remaining prompt', () => {
  const speaker = createSpeaker();
  speaker.speak('X. X is for xylophone. X.', 'letters');
  const player = playerFor('name-x'); player.emit('load'); player.emit('playerror');
  expect(utterances[0].text).toBe('X.');
  const oldEnd = utterances[0].onend;
  speaker.speak('Unrecorded.');
  oldEnd();
  expect(utterances.map(u => u.text)).toEqual(['X.', 'Unrecorded.']);
  speaker.cancel();
});

it('falls back if a pack never loads and does not play after cancellation', () => {
  const speaker = createSpeaker();
  playerFor('name-z').loaded = false;
  speaker.speak('Z. Z is for zebra. Z.', 'letters');
  const player = playerFor('name-z');
  vi.advanceTimersByTime(10000);
  expect(utterances[0].text).toBe('Z.');
  speaker.cancel();
  const count = player.play.mock.calls.length;
  player.emit('load'); player.emit('end');
  expect(player.play).toHaveBeenCalledTimes(count);
});

it('plays approved recordings even without device speech support', () => {
  vi.stubGlobal('speechSynthesis', undefined);
  const speaker = createSpeaker();
  speaker.speak('A.', 'letters');
  const player = playerFor('name-a'); player.emit('load');
  expect(player.play).toHaveBeenLastCalledWith('name-a');
  speaker.cancel();
});

const published = (key: string, role = 'word-name'): PublishedClip => ({
  role, clip: key, asset: 'approved-pack', url: '/coeus/lesson-media/approved-pack/' + 'a'.repeat(64),
  sha256: 'a'.repeat(64), mime_type: 'audio/mpeg', start_seconds: 1.25, duration_seconds: 0.5,
  transcript: 'A', language: 'en-US',
});

it('plays issued media from the Coeus sibling mount with explicit format and millisecond offsets', () => {
  window.history.replaceState({}, '', '/letterjam/');
  const done = vi.fn(), failed = vi.fn();
  const stop = playPublishedRecording(published('mount-test'), done, failed);
  const player = latest();
  expect(player.options.src).toEqual([window.location.origin + published('mount-test').url]);
  expect(player.options.format).toEqual(['mp3']);
  expect(player.options.sprite.clip).toEqual([1250, 500]);
  player.emit('load');
  expect(player.play).toHaveBeenCalledWith('clip');
  player.emit('end'); player.emit('playerror');
  expect(done).toHaveBeenCalledTimes(1);
  expect(failed).not.toHaveBeenCalled();
  stop();
  window.history.replaceState({}, '', '/');
});

it('sequences issued recordings and device context, and keeps speech independent of bundled mappings', () => {
  const speaker = createSpeaker(undefined, false);
  const recording = published('sequence');
  speaker.speak([{ text: 'A.', recording }, { text: 'A new issued sentence.' }, { text: 'A.', recording }]);
  const player = latest(); player.emit('load'); player.emit('end');
  expect(utterances.map(u => u.text)).toEqual(['A new issued sentence.']);
  utterances[0].onend();
  expect(player.play).toHaveBeenCalledTimes(2);
  speaker.cancel();
  expect(player.stop).toHaveBeenCalled();
});

it('falls back for unavailable issued packs and cancels stale completions on replay', () => {
  const speaker = createSpeaker(undefined, false);
  speaker.speak([{ text: 'Question.', recording: published('failed-load') }]);
  const player = latest(); player.emit('loaderror');
  expect(utterances.map(u => u.text)).toEqual(['Question.']);
  const end = utterances[0].onend;
  speaker.speak([{ text: 'Replay.', recording: published('replay') }]);
  end();
  const replay = latest();
  speaker.cancel();
  replay.emit('load');
  expect(replay.play).not.toHaveBeenCalled();
});

it('falls back when issued metadata is unusable without fetching a different origin', () => {
  const speaker = createSpeaker(undefined, false);
  const count = mock.players.length;
  speaker.speak([{ text: 'Safe fallback.', recording: { ...published('invalid'), url: 'https://example.org/audio.mp3' } }]);
  expect(mock.players).toHaveLength(count);
  expect(utterances.map(u => u.text)).toEqual(['Safe fallback.']);
  speaker.cancel();
});

it('uses revision-specific offsets and limits decoded recording memory', () => {
  const original = published('revision');
  playPublishedRecording(original, vi.fn(), vi.fn())();
  const first = latest();
  playPublishedRecording({ ...original, start_seconds: 2.5 }, vi.fn(), vi.fn())();
  expect(latest()).not.toBe(first);
  expect(latest().options.sprite.clip).toEqual([2500, 500]);
  for (let i = 0; i < 9; i++) playPublishedRecording(published('cache-' + i), vi.fn(), vi.fn())();
  expect(first.unload).toHaveBeenCalledTimes(1);
});
