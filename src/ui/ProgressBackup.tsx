import { useState } from 'react';
import type { SaveBlob } from '../engine/types';
import { parseProgress, protectProgress } from '../store/progressBackup';

export function ProgressBackup({ blob, onRestore }: {
  blob: SaveBlob;
  onRestore: (blob: SaveBlob) => Promise<void>;
}) {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const download = () => {
    try {
      const url = URL.createObjectURL(new Blob([JSON.stringify(blob, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `letter-jam-progress-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      setMessage('Save the progress file in Files or Downloads. Make a fresh backup after playing.');
      setError('');
    } catch { setError('Could not download progress. Please try again.'); }
  };
  return <details className="progress-backup">
    <summary>Keep progress safe</summary>
    <p>On iPad, use Safari’s Share → Add to Home Screen, then play from that icon. Back up here first and restore in the Home Screen app if your players do not appear.</p>
    <button onClick={() => void protectProgress().then(granted => setMessage(granted
      ? 'Long-term browser storage is enabled. Keep a backup too—clearing website data still removes progress.'
      : 'This browser has not granted long-term storage. Use the Home Screen app and keep a progress backup.'))}>Protect saved progress</button>
    <button onClick={download} disabled={!blob.profiles.length}>Download progress backup</button>
    <label>Restore progress backup
      <input type="file" accept=".json,application/json" onChange={async e => {
        const file = e.currentTarget.files?.[0];
        e.currentTarget.value = '';
        if (!file) return;
        setError(''); setMessage('');
        try {
          if (file.size > 10 * 1024 * 1024) throw Error('File too large');
          const imported = parseProgress(await file.text());
          await onRestore(imported);
          setMessage('Progress restored. Existing players and newer scores were kept.');
        } catch { setError('Could not restore progress. Use a Letter Jam backup and check that browser storage is available.'); }
      }} />
    </label>
    {message && <p role="status">{message}</p>}
    {error && <p role="alert">{error}</p>}
  </details>;
}
