import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { Context } from '../coeus/client';
import { RecoveryStore } from '../coeus/recovery';
import { RoundSession, type RoundState } from '../coeus/roundSession';
import { createSpeaker, wordAlone, wordPrompt, type Speaker } from '../engine/speech';
import { Feedback } from './Feedback';
import { resumeAudio } from './sound';

export function CoeusPlay({ context, onError, speaker: suppliedSpeaker }: {
  context: Context; onError: (error: Error) => void; speaker?: Speaker;
}) {
  const [speaker] = useState(() => suppliedSpeaker ?? createSpeaker(undefined, false));
  const session = useRef<RoundSession | null>(null);
  const [state, setState] = useState<RoundState>({ phase: 'loading', choices: [], wrongIds: [] });
  const [mode, setMode] = useState<'keepTrying' | 'oneAndDone'>('keepTrying');
  const [countdown, setCountdown] = useState(3);
  useEffect(() => {
    const game = new RoundSession(context, window.location.search, new RecoveryStore(context), setState);
    session.current = game;
    void game.start();
    return () => { game.stop(); speaker.cancel(); };
  }, [context, speaker]);
  useEffect(() => { if (state.error) onError(state.error); }, [state.error, onError]);
  const target = state.challenge?.target;
  const prompt = target ? wordPrompt(target.payload.text, target.payload.sentence ?? '') : '';
  useEffect(() => {
    if (state.phase !== 'playing' || !prompt) { speaker.cancel(); return; }
    speaker.speak(prompt);
    return () => speaker.cancel();
  }, [state.phase, state.challenge?.id, prompt, speaker]);
  useEffect(() => {
    setCountdown(3);
    if (state.phase !== 'completed') return;
    const timer = setInterval(() => setCountdown(value => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [state.phase, state.challenge?.id]);
  useEffect(() => {
    if (state.phase === 'completed' && countdown === 0) void session.current?.next(true);
  }, [countdown, state.phase]);

  if (state.phase === 'loading') return <p role="status">Loading your round…</p>;
  if (state.phase === 'empty') return <p role="status">There are no questions available for this lesson.</p>;
  if (state.phase === 'error' || !target) return null;
  const maxLength = Math.max(...state.choices.map(item => item.payload.text.length));
  const size = maxLength === 1 ? 'glyph' : maxLength >= 7 ? 'long' : '';
  return <div className="play">
    <div className="coeus-controls">
    <label className="coeus-answer-mode">After a wrong answer{' '}
      <select aria-label="After a wrong answer" value={mode} disabled={state.phase !== 'playing'}
        onChange={event => setMode(event.target.value as typeof mode)}>
        <option value="keepTrying">Keep trying</option>
        <option value="oneAndDone">Show the answer</option>
      </select>
    </label>
    <button className="speaker" aria-label="Hear the word again" onClick={() => speaker.speak(prompt)}>🔊</button>
    </div>
    <div className="cards" key={state.challenge!.id} data-count={state.choices.length} data-font="andika"
      style={{ '--round-font': '"Andika", sans-serif' } as CSSProperties}>
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
              speaker.speak(wordAlone(item.payload.text));
              speaker.queue(prompt);
            }
          });
        }}>{item.payload.text}</button>)}
    </div>
    {state.phase === 'saving' && <p role="status">Saving your answer…</p>}
    {state.phase === 'completed' && <div className="round-end">
      {state.notice && <p role="status">{state.notice}</p>}
      {state.ending === 'won' ? <Feedback level={state.known ? 'big' : 'small'} /> : <p className="aw">aw…</p>}
      <button className="next" onClick={() => void session.current?.next()}>Next ({countdown})</button>
    </div>}
  </div>;
}
