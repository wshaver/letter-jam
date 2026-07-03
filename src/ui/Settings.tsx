import type { Profile } from '../engine/types';

interface SettingsProps {
  profile: Profile;
  onChange: (p: Profile) => void;
  onBack: () => void;
}

export function Settings({ profile, onChange, onBack }: SettingsProps) {
  const mode = profile.settings.wrongAnswerMode;
  return (
    <div className="settings">
      <h1>Settings — {profile.name}</h1>
      <label className="setting-row">
        <input
          type="checkbox"
          checked={mode === 'oneAndDone'}
          onChange={(e) =>
            onChange({
              ...profile,
              settings: {
                ...profile.settings,
                wrongAnswerMode: e.target.checked ? 'oneAndDone' : 'keepTrying',
              },
            })
          }
        />
        Stop after a wrong answer (harder)
      </label>
      <button onClick={onBack}>Done</button>
    </div>
  );
}
