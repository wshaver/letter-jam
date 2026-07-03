import { render, screen } from '@testing-library/react';
import { App } from './ui/App';

it('renders the profile select screen after load', async () => {
  render(<App />);
  expect(await screen.findByText("Who's playing?")).toBeInTheDocument();
});
