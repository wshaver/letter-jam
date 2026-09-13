import { useCallback, useEffect, useState } from 'react';
import type { Profile, SaveBlob } from '../engine/types';
import { LocalStorageProfileStore } from '../store/LocalStorageProfileStore';
import { createSpeaker } from '../engine/speech';
import { wordsForMode } from '../engine/words';
import { createProfile, upsertProfile } from '../engine/profiles';
import { newId } from '../engine/id';
import { ProfileSelect } from './ProfileSelect';
import { PlayScreen } from './PlayScreen';
import { Stats } from './Stats';
import { Settings } from './Settings';
import { ProgressBackup } from './ProgressBackup';
import { EMPTY_BLOB } from '../store/ProfileStore';
import { mergeProgress, protectProgress } from '../store/progressBackup';

const store = new LocalStorageProfileStore();
const speaker = createSpeaker();

type Screen = 'select' | 'play' | 'settings';

export function App() {
  const [blob, setBlob] = useState<SaveBlob | null>(null);
  const [screen, setScreen] = useState<Screen>('select');
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    store.load().then(setBlob).catch(() => {
      setSaveError('Browser storage is unavailable. Progress cannot be saved; download a backup before closing.');
      setBlob(structuredClone(EMPTY_BLOB));
    });
  }, []);

  // Functional updates: two profile changes can land between renders (e.g.
  // introducing words + recording a result) — never merge into a stale blob.
  const update = useCallback((fn: (prev: SaveBlob) => SaveBlob) => {
    setBlob((prev) => {
      if (!prev) return prev;
      const next = fn(prev);
      void store.save(next).then(() => setSaveError('')).catch(() =>
        setSaveError('Progress could not be saved. Download a backup in Settings before closing.'));
      return next;
    });
  }, []);

  const onProfileChange = useCallback((p: Profile) => update((prev) => upsertProfile(prev, p)), [update]);

  if (!blob) return <div className="loading">Loading…</div>;

  const active = blob.profiles.find((p) => p.id === blob.activeProfileId) ?? null;
  const backup = <>
    {saveError && <p role="alert">{saveError}</p>}
    <ProgressBackup blob={blob} onRestore={async imported => {
      const merged = mergeProgress(blob, imported);
      await store.save(merged);
      setBlob(merged);
      setSaveError('');
    }} />
  </>;

  if (screen === 'select' || !active) {
    return (
      <ProfileSelect
        blob={blob}
        onPick={(id) => {
          void protectProgress();
          update((prev) => ({ ...prev, activeProfileId: id }));
          setScreen('play');
        }}
        onCreate={(name, avatar) => {
          void protectProgress();
          const p = createProfile(newId(), name, avatar);
          update((prev) => upsertProfile({ ...prev, activeProfileId: p.id }, p));
          setScreen('play');
        }}
      >{backup}</ProfileSelect>
    );
  }

  if (screen === 'settings') {
    return <Settings profile={active} onChange={onProfileChange} onBack={() => setScreen('play')}>{backup}</Settings>;
  }

  return (
    <div className="app">
      {saveError && <p role="alert">{saveError}</p>}
      <header className="topbar">
        <span className="who">
          {active.avatar} {active.name}
        </span>
        <Stats profile={active} words={wordsForMode(active.settings.gameMode)} />
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
