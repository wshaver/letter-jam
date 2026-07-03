import { execSync } from 'node:child_process';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// A build-stamp so a deployed bundle can be identified at a glance: short git
// SHA + build time. Computed at build/dev-server start; injected via define.
function buildVersion(): string {
  let sha = 'nogit';
  try {
    sha = execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    // not a git checkout — fall back to 'nogit'
  }
  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
  return `${sha} · ${stamp} UTC`;
}

export default defineConfig({
  // Relative base so bundled assets load correctly whether the app is served
  // from the domain root or a subdirectory (e.g. willshaver.com/letterjam).
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(buildVersion()),
  },
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
});
