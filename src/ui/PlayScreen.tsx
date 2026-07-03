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
  if (!round) return null;

  return (
    <div className="play">
      <button className="speaker" aria-label="Hear the word again" onClick={replay}>
        🔊
      </button>
      <div className="cards">
        {round.choices.map((w, i) => {
          const reveal = status === 'missed' && w.id === round.target.id;
          return (
            <button
              key={w.id}
              className={`card ${w.text.length === 1 ? 'glyph' : ''} ${wrongIds.has(w.id) ? 'faded' : ''} ${reveal ? 'reveal' : ''}`}
              style={{ animationDelay: `${i * 0.15}s` }}
              disabled={wrongIds.has(w.id) || status !== 'playing'}
              onClick={() => choose(w)}
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
          <button className="next" onClick={next}>
            Next
          </button>
        </div>
      )}
    </div>
  );
}
