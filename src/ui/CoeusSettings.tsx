import { useEffect, useState } from 'react';
import { ContextError, type Context } from '../coeus/client';
import { loadProgress, type Progress } from '../coeus/progress';
import type { Preferences } from '../coeus/preferences';
import { FONTS } from '../engine/fonts';

export function CoeusSettings({ context, preferences, onChange, onBack, onError, storageWarning }: {
  context: Context; preferences: Preferences; onChange: (value: Preferences) => void;
  onBack: () => void; onError: (error: Error) => void; storageWarning: boolean;
}) {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const refresh = () => setRevision(value => value + 1);
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setProgress(null); setError(null);
    void loadProgress(context, controller.signal).then(value => {
      if (!controller.signal.aborted) setProgress(value);
    }).catch(cause => {
      if (controller.signal.aborted) return;
      if (cause instanceof ContextError && [401, 419, 403, 404].includes(cause.status)) onError(cause);
      else setError(cause instanceof Error ? cause.message : 'Shared progress is unavailable. Try again.');
    });
    return () => controller.abort();
  }, [context, revision, onError]);
  return <section className="coeus-settings" aria-label="Settings and progress">
    <h1>Settings & progress</h1>
    <button autoFocus onClick={onBack}>Back to round</button>
    <h2>Shared lesson progress</h2>
    <p>{context.student.name} · {context.lesson.title}</p>
    {progress ? <p role="status">Introduced: {progress.summary.introduced} · Mastered: {progress.summary.mastered} · Total: {progress.total_items}</p>
      : error ? <p role="alert">{error}</p> : <p role="status">Loading shared progress…</p>}
    <p>From Coeus across games and devices. Celebrations do not count as mastery.</p>
    <button onClick={() => setRevision(value => value + 1)}>Refresh progress</button>
    <h2>On this browser</h2>
    <p>Options for this student and lesson.</p>
    <label>After a wrong answer <select value={preferences.mode} onChange={event => onChange({ ...preferences, mode: event.target.value as Preferences['mode'] })}>
      <option value="keepTrying">Keep trying</option><option value="oneAndDone">Show the answer</option>
    </select></label>
    <label>Card font <select value={preferences.font} onChange={event => onChange({ ...preferences, font: event.target.value as Preferences['font'] })}>
      {FONTS.map(font => <option key={font.id} value={font.id}>{font.family}</option>)}
    </select></label>
    <label><input type="checkbox" checked={preferences.effects} onChange={event => onChange({ ...preferences, effects: event.target.checked })} /> Celebration effects and chimes</label>
    {storageWarning && <p role="status">Options work for now, but could not be saved on this browser.</p>}
    <p><a href={context.return_path}>Choose student or lesson in Coeus</a></p>
  </section>;
}
