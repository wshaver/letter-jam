import { useEffect, useState } from 'react';
import { bootstrap, ContextError, type Context } from '../coeus/client';

export function CoeusEntry() {
  const [context, setContext] = useState<Context | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setContext(null);
    setError(null);
    void bootstrap(window.location.search, controller.signal).then(value => {
      if (!controller.signal.aborted) setContext(value);
    }).catch(cause => {
      if (!controller.signal.aborted) setError(cause instanceof ContextError ? cause : new Error('Cannot reach Coeus. Check your connection, then retry.'));
    });
    return () => controller.abort();
  }, [retry]);
  return <main className="app">
    <h1>Letter Jam</h1>
    <a href={context?.return_path ?? '/coeus/games'}>Back to Coeus</a>
    {!context && !error && <p role="status">Connecting to Coeus…</p>}
    {error && <>
      <p role="alert">{error.message}</p>
      {error instanceof ContextError && [401, 419].includes(error.status) &&
        <p><a href="/coeus/login" target="_blank" rel="noopener noreferrer">Sign in to Coeus</a></p>}
      <button onClick={() => setRetry(value => value + 1)}>Retry connection</button>
    </>}
    {context && <>
      <h2>{context.student.name}</h2>
      <p>{context.lesson.title} · Version {context.lesson.version}</p>
      <p role="status">Connected. Coeus gameplay is coming next; return to the catalog to choose another game.</p>
    </>}
  </main>;
}
