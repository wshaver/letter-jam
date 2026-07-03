import { useCallback, useEffect, useState } from 'react';
import type { Profile, SaveBlob } from '../engine/types';
import { LocalStorageProfileStore } from '../store/LocalStorageProfileStore';
import { createSpeaker } from '../engine/speech';
import { wordsForMode } from '../engine/words';
import { createProfile, upsertProfile } from '../engine/profiles';
import { newId } from '../engine/id';
import { ProfileSelect } from './ProfileSelect';
import { PlayScreen } from './PlayScreen';
import { Settings } from './Settings';

const store = new LocalStorageProfileStore();
const speaker = createSpeaker();

type Screen = 'select' | 'play' | 'settings';

export function App() {
  const [blob, setBlob] = useState<SaveBlob | null>(null);
  const [screen, setScreen] = useState<Screen>('select');

  useEffect(() => {
    store.load().then(setBlob);
  }, []);

  // Functional updates: two profile changes can land between renders (e.g.
  // introducing words + recording a result) — never merge into a stale blob.
  const update = useCallback((fn: (prev: SaveBlob) => SaveBlob) => {
    setBlob((prev) => {
      if (!prev) return prev;
      const next = fn(prev);
      void store.save(next);
      return next;
    });
  }, []);

  const onProfileChange = useCallback((p: Profile) => update((prev) => upsertProfile(prev, p)), [update]);

  if (!blob) return <div className="loading">Loading…</div>;

  const active = blob.profiles.find((p) => p.id === blob.activeProfileId) ?? null;

  if (screen === 'select' || !active) {
    return (
      <ProfileSelect
        blob={blob}
        onPick={(id) => {
          update((prev) => ({ ...prev, activeProfileId: id }));
          setScreen('play');
        }}
        onCreate={(name, avatar) => {
          const p = createProfile(newId(), name, avatar);
          update((prev) => upsertProfile({ ...prev, activeProfileId: p.id }, p));
          setScreen('play');
        }}
      />
    );
  }

  if (screen === 'settings') {
    return <Settings profile={active} onChange={onProfileChange} onBack={() => setScreen('play')} />;
  }

  return (
    <div className="app">
      <header className="topbar">
        <span className="who">
          {active.avatar} {active.name}
        </span>
        <span className="spacer" />
        <button aria-label="Settings" onClick={() => setScreen('settings')}>
          ⚙️
        </button>
        <button aria-label="Switch player" onClick={() => setScreen('select')}>
          👥
        </button>
      </header>
      <PlayScreen
        key={`${active.id}:${active.settings.gameMode}`}
        profile={active}
        onProfileChange={onProfileChange}
        words={wordsForMode(active.settings.gameMode)}
        speaker={speaker}
      />
    </div>
  );
}
