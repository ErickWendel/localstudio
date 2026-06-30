import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../../../src/App';
import { createSampleProject } from '../../../src/domain/sampleProject';
import { BrowserShareService } from '../../../src/services/shareService';
import { TRANSLATION_LANGUAGE_OPTIONS } from '../../../src/ui/editor/translationLanguages';

describe('App', () => {
  beforeEach(() => {
    vi.stubGlobal('showDirectoryPicker', vi.fn());
    vi.stubGlobal('Translator', {
      availability: vi.fn().mockResolvedValue('available'),
    });
  });

  afterEach(() => {
    window.history.replaceState({}, '', '/');
    window.localStorage.clear();
    Object.defineProperty(document, 'modelContext', {
      configurable: true,
      value: undefined,
    });
    vi.unstubAllGlobals();
  });

  it('renders the application root', async () => {
    render(<App />);

    expect(await screen.findByText('LocalStudio.ai')).toBeInTheDocument();
  });

  it('starts with a blank project when requested from a new project tab', async () => {
    const user = userEvent.setup();
    window.history.replaceState({}, '', '/?newProject=1');

    render(<App />);

    expect(
      await screen.findByRole('button', { name: 'Edit project name Untitled Project' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Layout' }));
    expect(screen.getByText('1 layers on current page')).toBeInTheDocument();
  });

  it('removes the new project query string after consuming it', async () => {
    window.history.replaceState({}, '', '/?newProject=1&theme=dark');

    render(<App />);

    await screen.findByText('Untitled Project');
    expect(window.location.search).toBe('?theme=dark');
  });

  it('removes stale project context when opening a new blank project tab', async () => {
    window.history.replaceState({}, '', '/?project=Old+Deck&newProject=1');

    render(<App />);

    await screen.findByText('Untitled Project');
    expect(window.location.search).toBe('');
  });

  it('opens the editor without requiring first-run setup', async () => {
    window.localStorage.clear();
    vi.stubGlobal('showDirectoryPicker', vi.fn());
    vi.stubGlobal('Translator', {
      availability: vi.fn().mockResolvedValue('available'),
    });

    render(<App />);

    expect(await screen.findByText('Untitled Project')).toBeInTheDocument();
    expect(screen.queryByText('LocalStudio.ai runs locally in this browser.')).not.toBeInTheDocument();
  });

  it('opens the editor even when browser capabilities are unavailable', async () => {
    vi.stubGlobal('showDirectoryPicker', undefined);
    vi.stubGlobal('Translator', undefined);

    render(<App />);

    expect(await screen.findByText('Untitled Project')).toBeInTheDocument();
    expect(screen.queryByText('LocalStudio.ai runs locally in this browser.')).not.toBeInTheDocument();
  });

  it('renders the WebMCP showcase page at /webmcp', () => {
    window.history.replaceState({}, '', '/webmcp');

    render(<App />);

    expect(screen.getByRole('heading', { name: 'WebMCP showcase' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Discover tools' })).toBeInTheDocument();
    expect(screen.getByTitle('LocalStudio editor WebMCP demo')).toHaveAttribute(
      'src',
      '/editor/?webmcp=1&newProject=1',
    );
  });

  it('renders the WebMCP showcase page under the editor base path', () => {
    window.history.replaceState({}, '', '/editor/webmcp');

    render(<App />);

    expect(screen.getByRole('heading', { name: 'WebMCP showcase' })).toBeInTheDocument();
  });

  it('renders a public shared deck page', async () => {
    const shareService = new BrowserShareService({ origin: window.location.origin });
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000101');
    await shareService.createShare(createSampleProject());
    window.history.replaceState({}, '', '/editor/s/00000000-0000-4000-8000-000000000101');

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Untitled AI Deck' })).toBeInTheDocument();
    expect(screen.getByText('1 / 1')).toBeInTheDocument();
  });

  it('renders a compact embedded shared deck page', async () => {
    const shareService = new BrowserShareService({ origin: window.location.origin });
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000102');
    await shareService.createShare(createSampleProject());
    window.history.replaceState({}, '', '/editor/embed/00000000-0000-4000-8000-000000000102');

    render(<App />);

    expect(await screen.findByLabelText('Embedded shared deck')).toBeInTheDocument();
    expect(screen.queryByText('Public view')).not.toBeInTheDocument();
  });

  it('opens editable command input for a WebMCP workflow step', async () => {
    const user = userEvent.setup();
    window.history.replaceState({}, '', '/webmcp');

    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Create project' }));

    expect(screen.getByLabelText('Create project command input')).toHaveValue('WebMCP Demo Deck');
    expect(screen.getByRole('button', { name: 'Send Create project' })).toBeInTheDocument();
  });

  it('shows the AI tools translation options for the WebMCP translate step', async () => {
    const user = userEvent.setup();
    window.history.replaceState({}, '', '/webmcp');

    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Translate deck' }));

    const languageSelect = screen.getByLabelText('Translate deck command input');
    const options = within(languageSelect).getAllByRole<HTMLOptionElement>('option');
    expect(options).toHaveLength(TRANSLATION_LANGUAGE_OPTIONS.length);
    expect(options.map((option) => option.value)).toEqual(
      TRANSLATION_LANGUAGE_OPTIONS.map((language) => language.code),
    );
    expect(screen.getByRole('option', { name: 'Hebrew (iw) 🇮🇱' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Chinese (Traditional) (zh-Hant) 🇹🇼' })).toBeInTheDocument();
  });

  it('runs the WebMCP snapshot step without showing a command input', async () => {
    const user = userEvent.setup();
    const executeSnapshot = vi.fn().mockResolvedValue({ project: { name: 'Demo' } });
    window.history.replaceState({}, '', '/webmcp');
    Object.defineProperty(document, 'modelContext', {
      configurable: true,
      value: {
        getTools: vi.fn().mockResolvedValue([
          { name: 'get_project_snapshot', description: 'Read snapshot', execute: executeSnapshot },
        ]),
      },
    });

    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Discover tools' }));
    await user.click(screen.getByRole('button', { name: 'Read snapshot' }));

    await waitFor(() => {
      expect(executeSnapshot).toHaveBeenCalledWith({});
    });
    expect(screen.queryByLabelText('Read snapshot command input')).not.toBeInTheDocument();
    expect(screen.getByText('Read snapshot completed.')).toBeInTheDocument();
  });

  it('focuses the matching workflow step when a discovered tool is selected', async () => {
    const user = userEvent.setup();
    window.history.replaceState({}, '', '/webmcp');
    Object.defineProperty(document, 'modelContext', {
      configurable: true,
      value: {
        getTools: vi.fn().mockResolvedValue([
          { name: 'create_project', description: 'Create project', execute: vi.fn() },
          { name: 'generate_slides', description: 'Generate slides', execute: vi.fn() },
        ]),
      },
    });

    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Discover tools' }));
    await user.click(await screen.findByRole('button', { name: 'generate_slides' }));

    const stepButton = screen.getByRole('button', { name: 'Generate slide' });
    expect(stepButton).toHaveFocus();
    expect(stepButton).toHaveClass('webmcp-step-button-focused');
  });
});
