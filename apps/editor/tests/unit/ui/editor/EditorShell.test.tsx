import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { sampleProject } from '../../../../src/domain/projects/sampleProject';
import type {
  WebMcpDemoWindow,
  WebMcpTool,
} from '../../../../src/services/webmcp/webMcpToolAdapter';
import { EditorShell } from '../../../../src/ui/editor/shell/EditorShell';
import { editorShellTestHarness } from './EditorShell.test-harness';

const {
  createAppServices,
  openLeftTab,
  selectImageLayer,
} = editorShellTestHarness;

const originalMatchMedia = window.matchMedia;

describe('EditorShell', () => {
  afterEach(() => {
    window.history.pushState({}, '', '/editor/');
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: originalMatchMedia,
    });
    Object.defineProperty(document, 'modelContext', {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      value: null,
    });
    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
      configurable: true,
      value: undefined,
    });
    delete (window as WebMcpDemoWindow).localStudioWebMcpTools;
    vi.restoreAllMocks();
  });

  it('registers WebMCP tools by default', async () => {
    const registerTools = vi.fn<(tools: WebMcpTool[]) => void>();
    window.history.pushState({}, '', '/editor/');
    Object.defineProperty(document, 'modelContext', {
      configurable: true,
      value: { registerTools },
    });

    render(<EditorShell services={createAppServices()} />);

    await waitFor(() => {
      expect(registerTools).toHaveBeenCalled();
    });
    const tools = registerTools.mock.calls[0]?.[0] ?? [];
    expect(tools.map((tool) => tool.name)).toEqual([
      'create_project',
      'generate_slides',
      'generate_image',
      'translate_text',
      'get_project_snapshot',
    ]);
  });

  it('can disable WebMCP protocol registration from the editor URL', async () => {
    const registerTools = vi.fn<(tools: WebMcpTool[]) => void>();
    window.history.pushState({}, '', '/editor/?webmcp=0');
    Object.defineProperty(document, 'modelContext', {
      configurable: true,
      value: { registerTools },
    });

    render(<EditorShell services={createAppServices()} />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'LocalStudio.dev' })).toBeInTheDocument();
    });
    expect(registerTools).not.toHaveBeenCalled();
    expect((window as WebMcpDemoWindow).localStudioWebMcpTools).toBeUndefined();
  });

  it('exposes same-origin demo tools when WebMCP runtime is unavailable', async () => {
    window.history.pushState({}, '', '/editor/');

    render(<EditorShell services={createAppServices()} />);

    await waitFor(() => {
      expect((window as WebMcpDemoWindow).localStudioWebMcpTools).toHaveLength(5);
    });
    expect((window as WebMcpDemoWindow).localStudioWebMcpTools?.map((tool) => tool.name)).toEqual([
      'create_project',
      'generate_slides',
      'generate_image',
      'translate_text',
      'get_project_snapshot',
    ]);
  });

  it('keeps WebMCP embeds available inside narrow host frames', async () => {
    const matchMedia = vi.fn().mockReturnValue({
      addEventListener: vi.fn(),
      matches: true,
      removeEventListener: vi.fn(),
    });
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: matchMedia,
    });
    window.history.pushState({}, '', '/editor/?webmcp=1');

    render(<EditorShell services={createAppServices()} />);

    expect(await screen.findByRole('heading', { name: 'LocalStudio.dev' })).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Open this workspace on a desktop screen.' }),
    ).not.toBeInTheDocument();
    expect((window as WebMcpDemoWindow).localStudioWebMcpTools).toHaveLength(5);
  });

  it('renders the approved editor shell landmarks', async () => {
    render(<EditorShell services={createAppServices()} />);

    expect(screen.getByRole('heading', { name: 'LocalStudio.dev' })).toBeInTheDocument();
    expect(screen.getByText('Untitled AI Deck')).toBeInTheDocument();
    expect(screen.getByText('PT')).toBeInTheDocument();
    expect(await screen.findByText('EN')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Prompt actions' })).toBeInTheDocument();
    expect(screen.getByLabelText('Create image prompt')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Layout' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByLabelText('Slide canvas')).toHaveAttribute('data-selected-elements', '');
  });

  it('does not select any element on startup', async () => {
    const user = userEvent.setup();
    render(<EditorShell services={createAppServices()} />);

    expect(screen.getByLabelText('Slide canvas')).toHaveAttribute('data-selected-elements', '');

    await openLeftTab(user, 'Layout');
    expect(screen.getByRole('button', { name: 'Selected Image' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('clears element selection when selecting a page from the pages panel', async () => {
    const user = userEvent.setup();
    const project = sampleProject.createSampleProject();
    project.pages = [
      project.pages[0]!,
      {
        ...project.pages[0]!,
        id: 'page-2',
        name: 'Slide 2',
      },
    ];
    render(<EditorShell services={createAppServices({ initialProject: project })} />);

    await selectImageLayer(user);
    expect(screen.getByLabelText('Slide canvas')).toHaveAttribute(
      'data-selected-elements',
      'image-hero',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Toggle pages panel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Select Slide 2' }));

    await waitFor(() => {
      expect(screen.getByText('2 / 2')).toBeInTheDocument();
      expect(screen.getByLabelText('Slide canvas')).toHaveAttribute('data-selected-elements', '');
    });
  });

  it('does not show the page size overlay on the canvas', () => {
    render(<EditorShell services={createAppServices()} />);

    expect(screen.queryByText('1920 x 1080')).not.toBeInTheDocument();
  });
});
