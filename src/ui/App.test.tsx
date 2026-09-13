import { render, screen } from '@testing-library/react';
import { afterEach, it, expect } from 'vitest';
import { App } from './App';

afterEach(() => window.history.replaceState({}, '', '/'));

it.each(['/', '/letterjam/'])('direct entry at %s requires Coeus selection', async (path) => {
  window.history.replaceState({}, '', path);
  render(<App />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Choose a student and lesson in Coeus first.');
  expect(screen.getByRole('link', { name: 'Back to Coeus' })).toHaveAttribute('href', '/coeus/games');
});
