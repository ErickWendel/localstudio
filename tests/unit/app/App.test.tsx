import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from '../../../src/App';

describe('App', () => {
  afterEach(() => {
    window.history.replaceState({}, '', '/');
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
});
