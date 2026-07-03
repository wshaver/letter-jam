import { useState } from 'react';
import type { SaveBlob } from '../engine/types';
import { soundDiagnostic } from './sound';

const AVATARS = ['🦄', '🐯', '🐸', '🐙', '🦊', '🐝'];

interface ProfileSelectProps {
  blob: SaveBlob;
  onPick: (id: string) => void;
  onCreate: (name: string, avatar: string) => void;
}

export function ProfileSelect({ blob, onPick, onCreate }: ProfileSelectProps) {
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [audioStatus, setAudioStatus] = useState('');

  return (
    <div className="select">
      <h1>Who's playing?</h1>
      <ul className="profiles">
        {blob.profiles.map((p) => (
          <li key={p.id}>
            <button onClick={() => onPick(p.id)}>
              {p.avatar} {p.name}
            </button>
          </li>
        ))}
      </ul>
      <form
        className="new-player"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) onCreate(name.trim(), avatar);
        }}
      >
        <div className="avatars">
          {AVATARS.map((a) => (
            <button
              type="button"
              key={a}
              className={a === avatar ? 'sel' : ''}
              onClick={() => setAvatar(a)}
            >
              {a}
            </button>
          ))}
        </div>
        <input
          aria-label="New player name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
        />
        <button type="submit">Add player</button>
      </form>
      {/* Audio diagnostic: plays the chime inside this tap and reports state. */}
      <div className="audio-check">
        <button type="button" onClick={() => setAudioStatus(soundDiagnostic())}>
          Test sound 🔊
        </button>
        {audioStatus && <span className="audio-status">{audioStatus}</span>}
      </div>
      {/* Rendered from the JS bundle, so seeing it confirms the JS loaded and
          the stamp confirms which build is deployed. */}
      <p className="version" data-testid="version">
        v{__APP_VERSION__}
      </p>
    </div>
  );
}
