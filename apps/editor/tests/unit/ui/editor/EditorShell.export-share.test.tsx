import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { unzipSync } from 'fflate';
import { vi } from 'vitest';
import type { ProjectDocument } from '../../../../src/domain/documents/model';
import { sampleProject } from '../../../../src/domain/projects/sampleProject';
import type {
  PresentationExportProgress,
  PresentationExportResult,
  PresentationExportService,
} from '../../../../src/services/contracts/interfaces';
import { EditorShell } from '../../../../src/ui/editor/shell/EditorShell';
import { editorShellTestHarness } from './EditorShell.test-harness';

const {
  LoadingProjectRepository,
  RecordingMirrorService,
  RecordingShareService,
  SavingProjectRepository,
  createAppServices,
  enableSyncedSharing,
  waitForShareButtonReady,
} = editorShellTestHarness;

describe('EditorShell export and share workflows', () => {
  afterEach(() => {
    vi.useRealTimers();
    window.history.pushState({}, '', '/editor/');
    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
      configurable: true,
      value: undefined,
    });
    vi.restoreAllMocks();
  });

  it('saves the local project before opening Share when mirror storage is configured', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem('ew-canvas-ai.persistence-enabled', 'false');
    const services = createAppServices({ skipStoredProjectLoad: true });
    services.projectRepository = new SavingProjectRepository();
    services.mirrorService = new RecordingMirrorService();

    render(<EditorShell services={services} />);

    await user.click(screen.getByRole('button', { name: 'Share' }));

    expect(screen.getByRole('dialog', { name: 'Save local project' })).toBeInTheDocument();
    expect(screen.getByLabelText('Project folder name')).toHaveValue('Untitled AI Deck');

    await user.click(screen.getByRole('button', { name: 'Choose folder' }));

    expect(screen.getByRole('heading', { name: 'Share design' })).toBeInTheDocument();
    expect(
      screen.getByText('Public links cannot be created without remote storage.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Configure mirror storage' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Download' })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Present' })).not.toBeDisabled();
  });

  it('saves the local project before opening mirror settings when storage is not configured', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem('ew-canvas-ai.persistence-enabled', 'false');
    const services = createAppServices();
    services.projectRepository = new SavingProjectRepository();
    services.mirrorService = new RecordingMirrorService(null);

    render(<EditorShell services={services} />);

    await user.click(screen.getByRole('button', { name: 'Share' }));

    expect(screen.getByRole('dialog', { name: 'Save local project' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Choose folder' }));

    expect(screen.getByRole('dialog', { name: 'Mirror settings' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Share design' })).not.toBeInTheDocument();
  });

  it('exports the current slide as a PNG file', async () => {
    const services = createAppServices();
    enableSyncedSharing(services);
    const downloadDataUrl = vi.fn();
    services.exportService = {
      getImagesArchiveFileName: () => 'deck-images.zip',
      getPageImageFileName: () => 'slide.png',
      getPdfFileName: () => 'deck.pdf',
      getPowerPointFileName: () => 'deck.pptx',
      downloadBlob: vi.fn(),
      downloadDataUrl,
    };

    render(<EditorShell services={services} />);

    await waitForShareButtonReady();
    fireEvent.click(screen.getByRole('button', { name: 'Share' }));
    fireEvent.click(screen.getByRole('button', { name: 'Download' }));

    expect(downloadDataUrl).toHaveBeenCalledWith(
      expect.stringMatching(/^data:image\/png/),
      'slide.png',
    );
  });

  it('exports all slides as PNG files in one ZIP archive from the File menu', async () => {
    const project = sampleProject.createSampleProject();
    const firstPage = project.pages[0];
    if (!firstPage) throw new Error('Sample project must contain a page.');
    const multiSlideProject: ProjectDocument = {
      ...project,
      pages: [
        firstPage,
        {
          ...firstPage,
          id: 'page-2',
          name: 'Hidden Summary',
          visible: false,
        },
      ],
    };
    const services = createAppServices({ initialProject: multiSlideProject });
    const downloadBlob = vi.fn();
    services.exportService = {
      getImagesArchiveFileName: () => 'deck-images.zip',
      getPageImageFileName: (_project, pageId) =>
        pageId === 'page-1' ? 'deck-slide-1.png' : 'deck-hidden-summary.png',
      getPdfFileName: () => 'deck.pdf',
      getPowerPointFileName: () => 'deck.pptx',
      downloadBlob,
      downloadDataUrl: vi.fn(),
    };

    render(<EditorShell services={services} />);

    fireEvent.click(screen.getByRole('button', { name: 'File' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Export to' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Images (.zip)' }));

    expect(screen.getByRole('dialog', { name: 'Export images' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'All' })).toBeChecked();
    expect(
      screen.getByRole('checkbox', { name: 'Create an image for each animation' }),
    ).not.toBeChecked();
    expect(screen.getByRole('combobox', { name: 'Image format' })).toHaveValue('png');
    fireEvent.click(screen.getByRole('button', { name: 'Export images' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Exporting slide images...');
    await waitFor(() => {
      expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob), 'deck-images.zip');
    });
    const [archiveBlob] = downloadBlob.mock.calls[0] as [Blob, string];
    const archiveFiles = unzipSync(new Uint8Array(await archiveBlob.arrayBuffer()));

    expect(Object.keys(archiveFiles).sort()).toEqual([
      'deck-hidden-summary.png',
      'deck-slide-1.png',
    ]);
  });

  it('exports a single readable final-state image when animation images are disabled', async () => {
    const project = sampleProject.createSampleProject();
    const firstPage = project.pages[0];
    if (!firstPage) throw new Error('Sample project must contain a page.');
    const configuredProject: ProjectDocument = {
      ...project,
      pages: [
        {
          ...firstPage,
          animationBuilds: [
            {
              id: 'build-title',
              delayMs: 0,
              effect: 'fade',
              elementId: 'text-title',
              trigger: 'on-click',
            },
            {
              id: 'build-subtitle-out',
              delayMs: 0,
              effect: 'fade',
              elementId: 'text-subtitle',
              kind: 'build-out',
              trigger: 'on-click',
            },
          ],
        },
      ],
    };
    const services = createAppServices({ initialProject: configuredProject });
    const downloadBlob = vi.fn();
    services.exportService = {
      getImagesArchiveFileName: () => 'deck-images.zip',
      getPageImageFileName: (_project, _pageId, extension) => `deck-slide-1.${extension}`,
      getPdfFileName: () => 'deck.pdf',
      getPowerPointFileName: () => 'deck.pptx',
      downloadBlob,
      downloadDataUrl: vi.fn(),
    };

    render(<EditorShell services={services} />);

    fireEvent.click(screen.getByRole('button', { name: 'File' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Export to' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Images (.zip)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Export images' }));

    await waitFor(() => {
      expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob), 'deck-images.zip');
    });
    const [archiveBlob] = downloadBlob.mock.calls[0] as [Blob, string];
    const archiveFiles = unzipSync(new Uint8Array(await archiveBlob.arrayBuffer()));

    expect(Object.keys(archiveFiles)).toEqual(['deck-slide-1.png']);
  });

  it('applies image export range, format, and animation options', async () => {
    const user = userEvent.setup();
    const project = sampleProject.createSampleProject();
    const firstPage = project.pages[0];
    if (!firstPage) throw new Error('Sample project must contain a page.');
    const configuredProject: ProjectDocument = {
      ...project,
      pages: [
        {
          ...firstPage,
          animationBuilds: [
            {
              id: 'build-title',
              delayMs: 0,
              effect: 'fade',
              elementId: 'text-title',
              trigger: 'on-click',
            },
          ],
        },
        {
          ...firstPage,
          id: 'page-2',
          name: 'Appendix',
        },
      ],
    };
    const services = createAppServices({ initialProject: configuredProject });
    const downloadBlob = vi.fn();
    services.exportService = {
      getImagesArchiveFileName: () => 'deck-images.zip',
      getPageImageFileName: (_project, pageId, extension) =>
        pageId === 'page-1' ? `deck-slide-1.${extension}` : `deck-appendix.${extension}`,
      getPdfFileName: () => 'deck.pdf',
      getPowerPointFileName: () => 'deck.pptx',
      downloadBlob,
      downloadDataUrl: vi.fn(),
    };

    render(<EditorShell services={services} />);

    fireEvent.click(screen.getByRole('button', { name: 'File' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Export to' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Images (.zip)' }));
    fireEvent.click(screen.getByRole('radio', { name: /From:/ }));
    await user.clear(screen.getByRole('spinbutton', { name: 'From slide' }));
    await user.type(screen.getByRole('spinbutton', { name: 'From slide' }), '1');
    await user.clear(screen.getByRole('spinbutton', { name: 'To slide' }));
    await user.type(screen.getByRole('spinbutton', { name: 'To slide' }), '1');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Create an image for each animation' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Image format' }), 'jpeg');
    fireEvent.click(screen.getByRole('button', { name: 'Export images' }));

    await waitFor(() => {
      expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob), 'deck-images.zip');
    });
    const [archiveBlob] = downloadBlob.mock.calls[0] as [Blob, string];
    const archiveFiles = unzipSync(new Uint8Array(await archiveBlob.arrayBuffer()));

    expect(Object.keys(archiveFiles)).toEqual(['deck-slide-1-animation-01.jpeg']);
  });

  it('exports PowerPoint with stats and clears the operation notice', async () => {
    const services = createAppServices();
    const downloadBlob = vi.fn();
    services.exportService = {
      getImagesArchiveFileName: () => 'deck-images.zip',
      getPageImageFileName: () => 'slide.png',
      getPdfFileName: () => 'deck.pdf',
      getPowerPointFileName: () => 'deck.pptx',
      downloadBlob,
      downloadDataUrl: vi.fn(),
    };
    let resolvePowerPointExport: ((value: PresentationExportResult) => void) | undefined;
    let reportPowerPointProgress: ((progress: PresentationExportProgress) => void) | undefined;
    services.presentationExportService = {
      exportPowerPoint: vi.fn<PresentationExportService['exportPowerPoint']>((_project, options) => {
        reportPowerPointProgress = options?.onProgress;
        options?.onProgress?.({
          current: 2,
          detail: 'Hero slide',
          label: 'Building slide 2 of 4',
          stage: 'building-slides',
          total: 4,
        });
        return new Promise<PresentationExportResult>((resolve) => {
          resolvePowerPointExport = resolve;
        });
      }),
    } satisfies PresentationExportService;

    render(<EditorShell services={services} />);

    fireEvent.click(screen.getByRole('button', { name: 'File' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Export to' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Powerpoint (.pptx)' }));

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Building slide 2 of 4');
      expect(screen.getByRole('status')).toHaveTextContent('Hero slide');
      expect(screen.getByLabelText('2 of 4')).toBeInTheDocument();
    });
    reportPowerPointProgress?.({
      detail: 'Checking media targets, content types, and timing targets.',
      label: 'Validating PowerPoint package',
      stage: 'validating-package',
    });
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Validating PowerPoint package');
      expect(screen.getByRole('status')).toHaveTextContent(
        'Checking media targets, content types, and timing targets.',
      );
    });
    vi.useFakeTimers();
    await act(async () => {
      resolvePowerPointExport?.({
        blob: new Blob(['pptx']),
        stats: {
          animationBuildCount: 2,
          mediaElementCount: 3,
          slideCount: 4,
        },
        warnings: [
          {
            code: 'pptx-animation-effect-downgraded',
            message: 'Animation was downgraded.',
          },
          {
            code: 'pptx-video-playback-downgraded',
            message: 'Video playback was downgraded.',
          },
        ],
      });
      await Promise.resolve();
    });
    expect(screen.getByRole('status')).toHaveTextContent(
      'PowerPoint exported: 4 slides, 3 media items, 2 animation builds; 1 animation fallback, 1 media fallback.',
    );
    expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob), 'deck.pptx');

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('copies and shows the prepared project public link from the share panel', async () => {
    const writeText = vi.fn();
    const execCommand = vi.fn().mockReturnValue(true);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText,
      },
    });
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: execCommand,
    });
    const services = createAppServices();
    enableSyncedSharing(services);

    render(<EditorShell services={services} />);

    await waitForShareButtonReady();
    fireEvent.click(screen.getByRole('button', { name: 'Share' }));
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));

    const expectedPublicUrl = `${
      window.location.origin
    }/editor/s/project-project-1?src=${encodeURIComponent(
      'http://localhost:9000/localstudio/mirrors/public-shares/project-project-1/share.json',
    )}`;
    expect(
      await screen.findByDisplayValue(expectedPublicUrl, undefined, { timeout: 3_000 }),
    ).toBeInTheDocument();
    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(writeText).not.toHaveBeenCalled();
  });

  it('publishes only the selected presenter recording from the share panel', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText,
      },
    });
    const project = sampleProject.createSampleProject();
    project.recordings = {
      'recording-old': {
        id: 'recording-old',
        name: 'Older take',
        createdAt: '2026-07-18T12:00:00.000Z',
        updatedAt: '2026-07-18T12:00:00.000Z',
        durationMs: 1000,
        language: 'en',
        modelPresetId: 'web-speech-api',
        audio: {
          mimeType: 'audio/webm;codecs=opus',
          objectUrl: 'blob:recording-old',
          storage: 'inline',
        },
        segments: [
          {
            id: 'old-segment',
            text: 'Old transcript',
            startMs: 0,
            endMs: 1000,
            final: true,
            pageIndex: 0,
            pageName: 'Slide 1',
          },
        ],
      },
      'recording-new': {
        id: 'recording-new',
        name: 'Newer take',
        createdAt: '2026-07-20T12:00:00.000Z',
        updatedAt: '2026-07-20T12:00:00.000Z',
        durationMs: 1200,
        language: 'en',
        modelPresetId: 'web-speech-api',
        audio: {
          mimeType: 'audio/webm;codecs=opus',
          objectUrl: 'blob:recording-new',
          storage: 'inline',
        },
        segments: [
          {
            id: 'new-segment',
            text: 'New transcript',
            startMs: 0,
            endMs: 1200,
            final: true,
            pageIndex: 0,
            pageName: 'Slide 1',
          },
        ],
      },
    };
    const services = createAppServices({ initialProject: project });
    const shareService = new RecordingShareService();
    services.mirrorService = new RecordingMirrorService();
    services.shareService = shareService;
    services.projectRepository = new LoadingProjectRepository(project);
    services.persistenceAvailable = true;
    services.skipStoredProjectLoad = false;

    render(<EditorShell services={services} />);

    await waitForShareButtonReady();
    fireEvent.click(screen.getByRole('button', { name: 'Share' }));
    expect(screen.getByLabelText('Recording for public share')).toHaveValue('recording-new');
    await user.selectOptions(screen.getByLabelText('Recording for public share'), 'recording-old');
    await user.click(screen.getByRole('button', { name: 'Copy link' }));

    await waitFor(() => {
      expect(
        shareService.updateShare.mock.calls.some(([, sharedProject]) =>
          Object.keys(sharedProject.recordings ?? {}).join(',') === 'recording-old',
        ),
      ).toBe(true);
    });
    const sharedProject = shareService.updateShare.mock.calls.find(([, candidate]) =>
      Object.keys(candidate.recordings ?? {}).join(',') === 'recording-old',
    )?.[1];
    expect(Object.keys(sharedProject?.recordings ?? {})).toEqual(['recording-old']);
    expect(sharedProject?.recordings?.['recording-old']?.segments[0]?.text).toBe('Old transcript');
  });

  it('enters fullscreen presentation mode from the share panel', async () => {
    const requestFullscreen = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
      configurable: true,
      value: requestFullscreen,
    });
    const services = createAppServices();
    enableSyncedSharing(services);

    render(<EditorShell services={services} />);

    await waitForShareButtonReady();
    fireEvent.click(screen.getByRole('button', { name: 'Share' }));
    fireEvent.click(screen.getByRole('button', { name: 'Present' }));

    expect(requestFullscreen).toHaveBeenCalled();
    expect(requestFullscreen.mock.instances[0]).toBe(screen.getByLabelText('Canvas workspace'));
  });
});
