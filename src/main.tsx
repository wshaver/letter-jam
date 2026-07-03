import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import './index.css';

// iOS Safari ignores user-scalable=no; block pinch-zoom explicitly.
for (const evt of ['gesturestart', 'gesturechange']) {
  document.addEventListener(evt, (e) => e.preventDefault());
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
