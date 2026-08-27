import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../../../src/App';
import { sampleProject } from '../../../src/domain/projects/sampleProject';

const originalMatchMedia = window.matchMedia;

describe('App', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/');
    window.localStorage.clear();
    vi.stubGlobal('showDirectoryPicker', vi.fn());
    vi.stubGlobal('Translator', {
      availability: vi.fn().mockResolvedValue('available'),
    });
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({
        addEventListener: vi.fn(),
        matches: false,
        removeEventListener: vi.fn(),
      }),
    });
  });

  afterEach(() => {
    window.history.replaceState({}, '', '/');
    window.localStorage.clear();
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: originalMatchMedia,
    });
    Object.defineProperty(document, 'modelContext', {
      configurable: true,
      value: undefined,
    });
    vi.unstubAllGlobals();
  });

  it('renders the application root', async () => {
    render(<App />);

    expect(
      await screen.findByRole('heading', { name: 'LocalStudio.dev' }, { timeout: 5000 }),
    ).toBeInTheDocument();
  });

  it('starts with a blank project when requested from a new project tab', async () => {
    window.history.replaceState({}, '', '/?newProject=1');

    render(<App />);

    expect(
      await screen.findByRole('button', { name: 'Edit project name Untitled Project' }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Layout' }));
    expect(screen.getByText('1 layers on current page')).toBeInTheDocument();
  });

  it('starts with persistence disabled on the plain editor route', async () => {
    window.history.replaceState({}, '', '/editor/');
    window.localStorage.setItem('ew-canvas-ai.persistence-enabled', 'true');

    render(<App />);

    expect(
      await screen.findByRole('button', { name: 'Edit project name Untitled Project' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Persistence disabled' })).toBeInTheDocument();
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

  it('opens the editor without a first-run setup gate when browser capabilities are unavailable', async () => {
    window.localStorage.clear();
    vi.stubGlobal('showDirectoryPicker', undefined);
    vi.stubGlobal('Translator', undefined);

    render(<App />);

    expect(await screen.findByText('Untitled Project')).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'LocalStudio.dev runs locally in this browser.' }),
    ).not.toBeInTheDocument();
  });

  it('renders the WebMCP showcase page at /webmcp', async () => {
    window.history.replaceState({}, '', '/webmcp');

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'WebMCP showcase' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Discover tools' })).toBeInTheDocument();
    expect(screen.getByTitle('LocalStudio editor WebMCP demo')).toHaveAttribute(
      'src',
      '/editor/?webmcp=1&newProject=1',
    );
  });

  it('renders the WebMCP showcase page at /webmcp/', async () => {
    window.history.replaceState({}, '', '/webmcp/');

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'WebMCP showcase' })).toBeInTheDocument();
  });

  it('renders the WebMCP showcase page under the editor base path', async () => {
    window.history.replaceState({}, '', '/editor/webmcp');

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'WebMCP showcase' })).toBeInTheDocument();
  });

  it('renders the presenter view route', async () => {
    window.history.replaceState({}, '', '/editor/?presenter=1&presenterSession=session-1');

    render(<App />);

    expect(await screen.findByLabelText('Presenter view')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Presenter Window' })).toBeInTheDocument();
  });

  it('renders a public shared deck page', async () => {
    const shareId = '00000000-0000-4000-8000-000000000101';
    const sourceUrl = `http://localhost:9000/localstudio/mirrors/public-shares/${shareId}/share.json`;
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              schemaVersion: 1,
              shareId,
              createdAt: '2026-06-30T10:00:00.000Z',
              updatedAt: '2026-06-30T10:00:00.000Z',
              project: sampleProject.createSampleProject(),
            }),
            { headers: { 'content-type': 'application/json' }, status: 200 },
          ),
        );
      }),
    );
    window.history.replaceState(
      {},
      '',
      `/editor/s/${shareId}?src=${encodeURIComponent(sourceUrl)}`,
    );

    render(<App />);

    expect(await screen.findByLabelText('Public presentation')).toHaveClass(
      'public-deck-viewer-present',
    );
    expect(screen.getByText('1 / 1')).toBeInTheDocument();
  });

  it('renders a public shared deck page from a static-host-safe query route', async () => {
    const shareId = '00000000-0000-4000-8000-000000000103';
    const sourceUrl = `http://localhost:9000/localstudio/mirrors/public-shares/${shareId}/share.json`;
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              schemaVersion: 1,
              shareId,
              createdAt: '2026-06-30T10:00:00.000Z',
              updatedAt: '2026-06-30T10:00:00.000Z',
              project: sampleProject.createSampleProject(),
            }),
            { headers: { 'content-type': 'application/json' }, status: 200 },
          ),
        );
      }),
    );
    window.history.replaceState(
      {},
      '',
      `/editor/?share=${shareId}&src=${encodeURIComponent(sourceUrl)}`,
    );

    render(<App />);

    expect(await screen.findByLabelText('Public presentation')).toHaveClass(
      'public-deck-viewer-present',
    );
    expect(screen.getByText('1 / 1')).toBeInTheDocument();
  });

  it('renders a compact embedded shared deck page', async () => {
    const shareId = '00000000-0000-4000-8000-000000000102';
    const sourceUrl = `http://localhost:9000/localstudio/mirrors/public-shares/${shareId}/share.json`;
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              schemaVersion: 1,
              shareId,
              createdAt: '2026-06-30T10:00:00.000Z',
              updatedAt: '2026-06-30T10:00:00.000Z',
              project: sampleProject.createSampleProject(),
            }),
            { headers: { 'content-type': 'application/json' }, status: 200 },
          ),
        );
      }),
    );
    window.history.replaceState(
      {},
      '',
      `/editor/embed/${shareId}?src=${encodeURIComponent(sourceUrl)}`,
    );

    render(<App />);

    expect(await screen.findByLabelText('Embedded shared deck')).toBeInTheDocument();
    expect(screen.queryByText('Public view')).not.toBeInTheDocument();
  });

  it('renders a compact embedded shared deck page from a static-host-safe query route', async () => {
    const shareId = '00000000-0000-4000-8000-000000000104';
    const sourceUrl = `http://localhost:9000/localstudio/mirrors/public-shares/${shareId}/share.json`;
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              schemaVersion: 1,
              shareId,
              createdAt: '2026-06-30T10:00:00.000Z',
              updatedAt: '2026-06-30T10:00:00.000Z',
              project: sampleProject.createSampleProject(),
            }),
            { headers: { 'content-type': 'application/json' }, status: 200 },
          ),
        );
      }),
    );
    window.history.replaceState(
      {},
      '',
      `/editor/?embed=${shareId}&src=${encodeURIComponent(sourceUrl)}`,
    );

    render(<App />);

    expect(await screen.findByLabelText('Embedded shared deck')).toBeInTheDocument();
    expect(screen.queryByText('Public view')).not.toBeInTheDocument();
  });
  it('renders the WebMCP showcase page under the editor base path with a trailing slash', () => {
    window.history.replaceState({}, '', '/editor/webmcp/');

    render(<App />);

    expect(screen.getByRole('heading', { name: 'WebMCP showcase' })).toBeInTheDocument();
  });

  it('opens editable command input for a WebMCP workflow step', () => {
    window.history.replaceState({}, '', '/webmcp');

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Create presentation' }));

    expect(screen.getByLabelText('Create presentation command input')).toHaveValue(
      'WebMCP Demo Deck',
    );
    expect(screen.getByRole('button', { name: 'Send Create presentation' })).toBeInTheDocument();
  });

  it('shows the complete JSON batch for the WebMCP upsert step', () => {
    window.history.replaceState({}, '', '/webmcp');

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Upsert slide' }));

    const batchInput = screen.getByLabelText<HTMLInputElement>('Upsert slide command input');
    expect(batchInput.value).toContain('"requestId"');
    expect(batchInput.value).toContain('"elements"');
  });

  it('runs the WebMCP snapshot step without showing a command input', async () => {
    const executeState = vi.fn().mockResolvedValue({ projectId: 'project-1', name: 'Demo' });
    window.history.replaceState({}, '', '/webmcp');
    Object.defineProperty(document, 'modelContext', {
      configurable: true,
      value: {
        getTools: vi
          .fn()
          .mockResolvedValue([
            { name: 'get_presentation_state', description: 'Read state', execute: executeState },
          ]),
      },
    });

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Discover tools' }));
    fireEvent.click(await screen.findByRole('button', { name: 'get_presentation_state' }));
    fireEvent.click(screen.getByRole('button', { name: 'Read presentation state' }));

    await waitFor(() => {
      expect(executeState).toHaveBeenCalledWith({ detail: 'elements', slideNumbers: [1] });
    });
    expect(
      screen.queryByLabelText('Read presentation state command input'),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Read presentation state completed.')).toBeInTheDocument();
  });

  it('runs WebMCP descriptor tools through the browser runtime executor', async () => {
    const createPresentationTool = {
      name: 'create_presentation',
      description: 'Create presentation',
    };
    const executeTool = vi.fn().mockResolvedValue({ ok: true, data: { name: 'Runtime Deck' } });
    window.history.replaceState({}, '', '/webmcp');
    Object.defineProperty(document, 'modelContext', {
      configurable: true,
      value: {
        executeTool,
        getTools: vi.fn().mockResolvedValue([createPresentationTool]),
      },
    });

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Discover tools' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Create presentation' }));
    fireEvent.change(screen.getByLabelText('Create presentation command input'), {
      target: { value: 'Runtime Deck' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send Create presentation' }));

    await waitFor(() => {
      expect(executeTool).toHaveBeenCalledWith(
        createPresentationTool,
        JSON.stringify({ name: 'Runtime Deck' }),
      );
    });
    expect(screen.getByText('Create presentation completed.')).toBeInTheDocument();
  });

  it('focuses the matching workflow step when a discovered tool is selected', async () => {
    window.history.replaceState({}, '', '/webmcp');
    Object.defineProperty(document, 'modelContext', {
      configurable: true,
      value: {
        getTools: vi.fn().mockResolvedValue([
          { name: 'create_presentation', description: 'Create presentation', execute: vi.fn() },
          { name: 'upsert_slide_content', description: 'Upsert slide', execute: vi.fn() },
        ]),
      },
    });

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Discover tools' }));
    fireEvent.click(await screen.findByRole('button', { name: 'upsert_slide_content' }));

    const stepButton = screen.getByRole('button', { name: 'Upsert slide' });
    expect(stepButton).toHaveFocus();
    expect(stepButton).toHaveClass('webmcp-step-button-focused');
  });
});
