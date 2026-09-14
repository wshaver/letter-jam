import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { Context } from '../coeus/client';
import { RecoveryStore } from '../coeus/recovery';
import { RoundSession, type RoundState } from '../coeus/roundSession';
import { createSpeaker, type Speaker } from '../engine/speech';
import { itemSpeech } from '../coeus/speech';
import { Feedback } from './Feedback';
import { resumeAudio } from './sound';
import { readPreferences, savePreferences, type Preferences } from '../coeus/preferences';
import { roundFont } from '../engine/fonts';
import { CoeusSettings } from './CoeusSettings';

export function CoeusPlay({ context, onError, speaker: suppliedSpeaker }: {
  context: Context; onError: (error: Error) => void; speaker?: Speaker;
}) {
  const [speaker] = useState(() => suppliedSpeaker ?? createSpeaker(undefined, false));
  const session = useRef<RoundSession | null>(null);
  const [state, setState] = useState<RoundState>({ phase: 'loading', choices: [], wrongIds: [] });
  const [preferences, setPreferences] = useState(() => readPreferences(context));
  const [storageWarning, setStorageWarning] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const mode = preferences.mode;
  const font = roundFont(preferences.font);
  const updatePreferences = (value: Preferences) => {
    setPreferences(value);
    setStorageWarning(!savePreferences(context, value));
  };
  const [countdown, setCountdown] = useState(3);
  useEffect(() => {
    const game = new RoundSession(context, window.location.search, new RecoveryStore(context), setState);
    session.current = game;
    void game.start();
    return () => { game.stop(); speaker.cancel(); };
  }, [context, speaker]);
  useEffect(() => { if (state.error) onError(state.error); }, [state.error, onError]);
  const target = state.challenge?.target;
  useEffect(() => {
    if (settingsOpen || state.phase !== 'playing' || !target) { speaker.cancel(); return; }
    speaker.speak(itemSpeech(target));
    return () => speaker.cancel();
  }, [state.phase, state.challenge?.id, target, speaker, settingsOpen]);
  useEffect(() => {
    setCountdown(3);
    if (state.phase !== 'completed' || settingsOpen) return;
    const timer = setInterval(() => setCountdown(value => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [state.phase, state.challenge?.id, settingsOpen]);
  useEffect(() => {
    if (!settingsOpen && state.phase === 'completed' && countdown === 0) void session.current?.next(true);
  }, [countdown, state.phase, settingsOpen]);

  if (settingsOpen) return <CoeusSettings context={context} preferences={preferences} onChange={updatePreferences}
    onBack={() => setSettingsOpen(false)} onError={onError} storageWarning={storageWarning} />;

  if (state.phase === 'loading') return <p role="status">Loading your round…</p>;
  if (state.phase === 'empty') return <p role="status">There are no questions available for this lesson.</p>;
  if (state.phase === 'error' || !target) return null;
  const maxLength = Math.max(...state.choices.map(item => item.payload.text.length));
  const size = maxLength === 1 ? 'glyph' : maxLength >= 7 ? 'long' : '';
  return <div className="play">
    <div className="coeus-controls">
    <label className="coeus-answer-mode">After a wrong answer{' '}
      <select aria-label="After a wrong answer" value={mode} disabled={state.phase !== 'playing'}
        onChange={event => updatePreferences({ ...preferences, mode: event.target.value as typeof mode })}>
        <option value="keepTrying">Keep trying</option>
        <option value="oneAndDone">Show the answer</option>
      </select>
    </label>
    <button disabled={state.phase !== 'playing'} onClick={() => setSettingsOpen(true)}>Settings & progress</button>
    <button className="speaker" aria-label="Hear the word again" onClick={() => speaker.speak(itemSpeech(target))}>🔊</button>
    </div>
    <div className="cards" key={state.challenge!.id} data-count={state.choices.length} data-font={font.id}
      style={{ '--round-font': `"${font.family}", ${font.kind}` } as CSSProperties}>
      {state.choices.map(item => <button key={item.id}
        className={`card ${size} ${state.wrongIds.includes(item.id) ? 'faded' : ''} ${state.ending === 'missed' && item.id === target.id ? 'reveal' : ''}`}
        disabled={state.phase !== 'playing' || state.wrongIds.includes(item.id)}
        onClick={() => {
          const game = session.current;
          if (!game || game.state.phase !== 'playing') return;
          speaker.cancel();
          resumeAudio();
          void game.choose(item.id, mode).then(() => {
            if (session.current !== game || game.state.phase !== 'playing') return;
            if (game.state.wrongIds.includes(item.id)) {
              speaker.speak(itemSpeech(item, false));
              speaker.queue(itemSpeech(target));
            }
          });
        }}>{item.payload.text}</button>)}
    </div>
    {state.phase === 'saving' && <p role="status">Saving your answer…</p>}
    {state.phase === 'completed' && <div className="round-end">
      {state.notice && <p role="status">{state.notice}</p>}
      {state.ending === 'won' ? preferences.effects ? <Feedback level={state.known ? 'big' : 'small'} /> : <p role="status">Nice!</p> : <p className="aw">aw…</p>}
      <button className="next" onClick={() => void session.current?.next()}>Next ({countdown})</button>
    </div>}
  </div>;
}
