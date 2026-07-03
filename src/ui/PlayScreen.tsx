import { useEffect, useState } from 'react';
import type { Profile, Word } from '../engine/types';
import type { Rng } from '../engine/random';
import type { Speaker } from '../engine/speech';
import { useGame } from './useGame';
import { Feedback } from './Feedback';

interface PlayScreenProps {
  profile: Profile;
  onProfileChange: (p: Profile) => void;
  words: Word[];
  speaker: Speaker;
  rng?: Rng;
}

export function PlayScreen(props: PlayScreenProps) {
  const { round, status, celebration, wrongIds, choose, replay, next } = useGame(props);

  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    if (status === 'playing') return;
    setCountdown(3);
    const id = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(id);
  }, [status]);

  useEffect(() => {
    if (status !== 'playing' && countdown <= 0) next({ auto: true });
  }, [countdown, status, next]);

  if (!round) return null;

  return (
    <div className="play">
      <button className="speaker" aria-label="Hear the word again" onClick={replay}>
        🔊
      </button>
      <div className="cards">
        {round.choices.map((w) => {
          const reveal = status === 'missed' && w.id === round.target.id;
          const size = w.text.length === 1 ? 'glyph' : w.text.length >= 7 ? 'long' : '';
          return (
            <button
              key={w.id}
              className={`card ${size} ${wrongIds.has(w.id) ? 'faded' : ''} ${reveal ? 'reveal' : ''}`}
              disabled={wrongIds.has(w.id) || status !== 'playing'}
              onPointerDown={() => choose(w)}
            >
              {w.text}
            </button>
          );
        })}
      </div>
      {status !== 'playing' && (
        <div className="round-end">
          {status === 'won' && celebration && <Feedback level={celebration} />}
          {status === 'missed' && <p className="aw">aw…</p>}
          <button className="next" onClick={() => next()}>
            Next ({Math.max(countdown, 0)})
          </button>
        </div>
      )}
    </div>
  );
}
