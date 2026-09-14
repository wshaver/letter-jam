import { useEffect, useState } from 'react';
import { ContextError, type Context } from '../coeus/client';
import { loadStatistics, type HeaderStatistics } from '../coeus/statistics';

export function CoeusHeader({ context, refreshKey, onSettings, onLeave, onError }: {
  context: Context; refreshKey: string; onSettings: () => void; onLeave: () => void; onError: (error: Error) => void;
}) {
  const [stats, setStats] = useState<HeaderStatistics | null>(null);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const [tip, setTip] = useState<number | null>(null);
  useEffect(() => {
    const refresh = () => setRevision(value => value + 1);
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setStats(null); setError(false);
    const timer = setTimeout(() => {
      void loadStatistics(context, controller.signal).then(value => {
        if (!controller.signal.aborted) setStats(value);
      }).catch(cause => {
        if (controller.signal.aborted) return;
        setError(true);
        if (cause instanceof ContextError && [401, 419, 403].includes(cause.status)) onError(cause);
      });
    }, 100);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [context, refreshKey, revision, onError]);
  useEffect(() => {
    if (tip === null) return;
    const timer = setTimeout(() => setTip(null), 2500);
    return () => clearTimeout(timer);
  }, [tip]);
  const chips = [
    ['🔥', stats?.streak, 'Correct answers in a row · Letter Jam'],
    ['⭐', stats?.first_try_wins, 'First-try wins · Letter Jam'],
    ['📚', stats?.student_wide.introduced, 'Items in the learning pile · All games'],
    ['🏆', stats?.student_wide.mastered, 'Items known really well · All games'],
    ['🎲', stats?.rounds, 'Rounds played · Letter Jam'],
  ] as const;
  return <header className="topbar">
    <strong>Letter Jam</strong><span className="who">{context.student.name}</span>
    <div className="stats" aria-label="Student statistics">
      {chips.map(([emoji, value, label], index) => <button key={emoji} className="stat" title={label}
        aria-label={`${label}: ${value ?? 'unavailable'}`} onClick={() => setTip(tip === index ? null : index)}>
        <span aria-hidden="true">{emoji} {value ?? '—'}</span>
        {tip === index && <span className="stat-tip" role="tooltip">{label}
          {index !== 2 && index !== 3 && stats?.coverage.game_history_complete === false && ' · Older unattributed rounds excluded'}
          {(index === 2 || index === 3) && stats?.student_wide.groups.map(group => <span className="stat-group" key={`${group.objective}:${group.content_type}`}>
            {group.content_type === 'letter' ? 'Letters' : group.content_type === 'word' ? 'Words' : 'Items'} ({group.objective}): {index === 2 ? group.introduced : group.mastered}
          </span>)}
        </span>}
      </button>)}
      {error && <button className="stats-retry" onClick={() => setRevision(value => value + 1)}>Retry statistics</button>}
    </div>
    <span className="spacer" />
    <nav aria-label="Game menu"><button onClick={onSettings}>Settings</button></nav>
    <a className="close-game" href={context.return_path} aria-label="Back to Coeus" title="Back to Coeus" onClick={onLeave}>×</a>
  </header>;
}
