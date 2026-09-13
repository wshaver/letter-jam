import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import { unlockAudio } from './ui/sound';
import { unlockRecordedAudio } from './engine/recordedAudio';
import { fitVisibleViewport } from './ui/viewport';
import { loadFonts } from './ui/loadFonts';
import './index.css';

// iOS Safari ignores user-scalable=no; block pinch-zoom explicitly.
for (const evt of ['gesturestart', 'gesturechange']) {
  document.addEventListener(evt, (e) => e.preventDefault());
}

// Unlock WebAudio (the celebration chime) on the first user gesture — iOS
// only lets a suspended AudioContext resume synchronously inside one.
const unlockEvents = ['pointerdown', 'touchend', 'mousedown', 'keydown'];
const unlock = () => {
  unlockAudio();
  unlockRecordedAudio();
  for (const evt of unlockEvents) window.removeEventListener(evt, unlock);
};
for (const evt of unlockEvents) window.addEventListener(evt, unlock);

const root = document.getElementById('root')!;
fitVisibleViewport(root);
const app = createRoot(root);
app.render(<div className="loading">Loading…</div>);
void loadFonts().then(() => app.render(<StrictMode><App /></StrictMode>));
