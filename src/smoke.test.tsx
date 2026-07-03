import { render, screen } from '@testing-library/react';
import { App } from './ui/App';

it('renders the app shell', () => {
  render(<App />);
  expect(screen.getByText('Letter Jam')).toBeInTheDocument();
});
