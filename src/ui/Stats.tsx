import type { Profile, Word } from '../engine/types';

interface StatsProps {
  profile: Profile;
  words: Word[]; // the active pool (mode-filtered)
}

export function Stats({ profile, words }: StatsProps) {
  const { stats } = profile.progress;
  const poolStates = words.map((w) => profile.progress.words[w.id]).filter((s) => s?.introduced);
  const mastered = poolStates.filter((s) => s.box >= 4).length; // box >= 4 = mastered

  return (
    <div className="stats">
      <span className="stat" title="Correct in a row">🔥 {stats.streak}</span>
      <span className="stat" title="First-try wins">⭐ {stats.correctFirstTry}</span>
      <span className="stat" title="Words in the pool">📚 {poolStates.length}</span>
      <span className="stat" title="Mastered">🏆 {mastered}</span>
      <span className="stat" title="Rounds played">🎲 {stats.rounds}</span>
    </div>
  );
}
