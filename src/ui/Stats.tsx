import { useEffect, useState } from 'react';
import type { Profile, Word } from '../engine/types';

interface StatsProps {
  profile: Profile;
  words: Word[]; // the active pool (mode-filtered)
}

export function Stats({ profile, words }: StatsProps) {
  const [tip, setTip] = useState<number | null>(null);

  // A tapped tooltip lingers briefly, then clears itself.
  useEffect(() => {
    if (tip === null) return;
    const id = setTimeout(() => setTip(null), 2500);
    return () => clearTimeout(id);
  }, [tip]);

  const { stats } = profile.progress;
  const poolStates = words.map((w) => profile.progress.words[w.id]).filter((s) => s?.introduced);
  const mastered = poolStates.filter((s) => s.box >= 4).length; // box >= 4 = mastered
  const kind = words[0]?.tags?.includes('letter') ? 'Letters' : 'Words';

  const chips = [
    { emoji: '🔥', value: stats.streak, label: 'Correct answers in a row' },
    { emoji: '⭐', value: stats.correctFirstTry, label: 'First-try wins, all time' },
    { emoji: '📚', value: poolStates.length, label: `${kind} in the learning pile` },
    { emoji: '🏆', value: mastered, label: `${kind} known really well` },
    { emoji: '🎲', value: stats.rounds, label: 'Rounds played' },
  ];

  return (
    <div className="stats">
      {chips.map((c, i) => (
        <button
          type="button"
          key={c.emoji}
          className="stat"
          title={c.label}
          onClick={() => setTip(tip === i ? null : i)}
        >
          {c.emoji} {c.value}
          {tip === i && (
            <span className="stat-tip" role="tooltip">
              {c.label}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
