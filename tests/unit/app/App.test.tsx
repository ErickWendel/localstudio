import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../../../src/App';
import { SETUP_COMPLETE_KEY } from '../../../src/services/localSetupService';

describe('App', () => {
  beforeEach(() => {
    window.localStorage.setItem(SETUP_COMPLETE_KEY, 'true');
  });

  afterEach(() => {
    window.history.replaceState({}, '', '/');
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('renders the application root', () => {
    render(<App />);

    expect(screen.getByText('LocalStudio.ai')).toBeInTheDocument();
  });

  it('starts with a blank project when requested from a new project tab', () => {
    window.history.replaceState({}, '', '/?newProject=1');

    render(<App />);

    expect(screen.getByRole('button', { name: 'Edit project name Untitled Project' })).toBeInTheDocument();
    expect(screen.getByText('1 layers on current page')).toBeInTheDocument();
  });

  it('removes the new project query string after consuming it', () => {
    window.history.replaceState({}, '', '/?newProject=1&theme=dark');

    render(<App />);

    expect(window.location.search).toBe('?theme=dark');
  });

  it('removes stale project context when opening a new blank project tab', () => {
    window.history.replaceState({}, '', '/?project=Old+Deck&newProject=1');

    render(<App />);

    expect(window.location.search).toBe('');
  });

  it('shows first-run setup before entering the editor', async () => {
    const user = userEvent.setup();
    window.localStorage.clear();
    vi.stubGlobal('showDirectoryPicker', vi.fn());
    vi.stubGlobal('Translator', {
      availability: vi.fn().mockResolvedValue('available'),
    });

    render(<App />);

    expect(await screen.findByText('LocalStudio.ai runs locally in this browser.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Continue to editor' }));

    expect(window.localStorage.getItem(SETUP_COMPLETE_KEY)).toBe('true');
    expect(await screen.findByText('Untitled AI Deck')).toBeInTheDocument();
  });
});
