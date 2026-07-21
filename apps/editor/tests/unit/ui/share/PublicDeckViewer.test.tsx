import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sampleProject } from '../../../../src/domain/projects/sampleProject';
import type {
  FontImportResult,
  FontImportService,
  ShareRecord,
} from '../../../../src/services/contracts/interfaces';
import { aiModelCatalog } from '../../../../src/services/model-setup/aiModelCatalog';
import { browserPromptService } from '../../../../src/services/prompting/browserPromptService';
import { BrowserShareService } from '../../../../src/services/sharing/shareService';
import { canvasWorkspaceUtils } from '../../../../src/ui/editor/canvas/canvasWorkspaceUtils';
import { PublicDeckViewer } from '../../../../src/ui/share/PublicDeckViewer';

describe('PublicDeckViewer', () => {
  let preloadedVideoUrls: string[];
  let fullscreenElement: Element | null;

  class MockPreloadImage extends EventTarget {
    naturalHeight = 480;
    naturalWidth = 640;
    private imageSrc = '';

    get src() {
      return this.imageSrc;
    }

    set src(value: string) {
      this.imageSrc = value;
      queueMicrotask(() => {
        this.dispatchEvent(new Event('load'));
      });
    }
  }

  const fontImportService: FontImportService = {
    listDownloadableFonts() {
      return [];
    },
    resolveAndDownloadFonts(): Promise<FontImportResult> {
      return Promise.resolve({ fonts: {}, resolutions: [], warnings: [] });
    },
    loadProjectFonts(): Promise<void> {
      return Promise.resolve();
    },
  };

  beforeEach(() => {
    preloadedVideoUrls = [];
    fullscreenElement = null;
    window.history.replaceState({}, '', '/');
    vi.stubGlobal('Image', MockPreloadImage);
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(null, { status: 204 }))));
    Object.defineProperty(navigator, 'gpu', {
      configurable: true,
      value: {},
    });
    Object.defineProperty(window, 'LanguageModel', {
      configurable: true,
      value: {
        availability: vi.fn().mockResolvedValue('available'),
        create: vi.fn().mockResolvedValue({ destroy: vi.fn(), prompt: vi.fn() }),
      },
    });
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(function loadMedia(
      this: HTMLMediaElement,
    ) {
      if (this instanceof HTMLVideoElement && this.src) {
        preloadedVideoUrls.push(this.src);
        queueMicrotask(() => {
          this.dispatchEvent(new Event('loadeddata'));
        });
      }
    });
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function playMedia(
      this: HTMLMediaElement,
    ) {
      this.dispatchEvent(new Event('play'));
      return Promise.resolve();
    });
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function pauseMedia(
      this: HTMLMediaElement,
    ) {
      this.dispatchEvent(new Event('pause'));
    });
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => fullscreenElement,
    });
    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
      configurable: true,
      value: vi.fn(() => {
        fullscreenElement = document.querySelector('[aria-label="Public presentation"]');
        document.dispatchEvent(new Event('fullscreenchange'));
        return Promise.resolve();
      }),
    });
    Object.defineProperty(document, 'exitFullscreen', {
      configurable: true,
      value: vi.fn(() => {
        fullscreenElement = null;
        document.dispatchEvent(new Event('fullscreenchange'));
        return Promise.resolve();
      }),
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'LanguageModel', {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(navigator, 'gpu', {
      configurable: true,
      value: undefined,
    });
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function getRequestUrl(input: RequestInfo | URL) {
    if (input instanceof Request) return input.url;
    if (input instanceof URL) return input.toString();
    return input;
  }

  function createRemoteShare(
    shareId: string,
    project = sampleProject.createSampleProject(),
  ): { shareService: BrowserShareService; share: ShareRecord } {
    const share: ShareRecord = {
      shareId,
      createdAt: '2026-06-30T10:00:00.000Z',
      updatedAt: '2026-06-30T10:00:00.000Z',
      project,
    };
    const sourceUrl = `http://localhost:9000/localstudio/mirrors/public-shares/${shareId}/share.json`;
    window.history.replaceState({}, '', `/editor/s/${shareId}?src=${encodeURIComponent(sourceUrl)}`);
    const requestFetch: typeof fetch = vi.fn((input: RequestInfo | URL) => {
      expect(getRequestUrl(input)).toBe(sourceUrl);
      return Promise.resolve(
        new Response(JSON.stringify({ schemaVersion: 1, ...share }), {
          headers: { 'content-type': 'application/json' },
          status: 200,
        }),
      );
    });
    return { share, shareService: new BrowserShareService({ fetch: requestFetch }) };
  }

  function createDeferredResponse() {
    let resolve!: (response: Response) => void;
    const promise = new Promise<Response>((nextResolve) => {
      resolve = nextResolve;
    });
    return { promise, resolve };
  }

  it('renders a shared deck in read-only mode', async () => {
    const { share, shareService } = createRemoteShare('00000000-0000-4000-8000-000000000201');
    render(
      <PublicDeckViewer
        shareId={share.shareId}
        fontImportService={fontImportService}
        shareService={shareService}
      />,
    );

    expect(await screen.findByLabelText('Public presentation')).toHaveClass('public-deck-viewer-present');
    expect(screen.queryByRole('heading', { name: 'Untitled AI Deck' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Slide canvas')).toHaveAttribute('data-selected-elements', '');
    expect(screen.getByRole('button', { name: 'Previous slide' })).toBeDisabled();
    expect(screen.queryByRole('region', { name: 'Presentation playback' })).not.toBeInTheDocument();
    expect(screen.getByText('1 / 1')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open transcript chat' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open slide list' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Open presentation AI' })).toBeEnabled();
  });

  it('opens transcript panel with public recording audio and segments', async () => {
    const project = sampleProject.createSampleProject();
    project.pages = [
      project.pages[0]!,
      {
        ...project.pages[0]!,
        id: 'page-2',
        name: 'Slide 2',
        background: { type: 'color', color: '#261255' },
      },
      {
        ...project.pages[0]!,
        id: 'page-3',
        name: 'Slide 3',
        background: { type: 'color', color: '#143522' },
      },
    ];
    project.recordings = {
      recording1: {
        id: 'recording1',
        name: 'Presenter recording',
        createdAt: '2026-07-18T12:00:00.000Z',
        updatedAt: '2026-07-18T12:00:00.000Z',
        durationMs: 2400,
        language: 'en',
        modelPresetId: 'web-speech-api',
        audio: {
          mimeType: 'audio/webm;codecs=opus',
          objectUrl: 'https://cdn.localstudio.test/recordings/recording1.webm',
          storage: 'remote',
        },
        segments: [
          {
            id: 'segment1',
            text: 'The roadmap includes transcript chat.',
            startMs: 0,
            endMs: 1200,
            final: true,
            pageIndex: 0,
            pageName: 'Slide 1',
          },
          {
            id: 'segment2',
            text: 'The second slide has synced audio.',
            startMs: 1200,
            endMs: 2400,
            final: true,
            pageIndex: 1,
            pageName: 'Slide 2',
          },
        ],
      },
    };
    const { share, shareService } = createRemoteShare(
      '00000000-0000-4000-8000-000000000207',
      project,
    );
    const user = userEvent.setup();
    render(
      <PublicDeckViewer
        shareId={share.shareId}
        fontImportService={fontImportService}
        shareService={shareService}
      />,
    );

    await screen.findByLabelText('Public presentation');
    expect(screen.getByRole('region', { name: 'Presentation playback' })).toBeInTheDocument();
    let audio = document.querySelector('audio');
    expect(audio).toBeInstanceOf(HTMLAudioElement);
    expect(screen.getByRole('button', { name: 'Jump to slide 1: Slide 1' })).toHaveStyle({
      '--public-deck-chapter-preview-left': '0px',
      '--public-deck-chapter-preview-x': '0%',
    });
    expect(screen.getByRole('button', { name: 'Jump to slide 3: Slide 3' })).toHaveStyle({
      '--public-deck-chapter-preview-left': '100%',
      '--public-deck-chapter-preview-x': '-100%',
    });
    await user.click(screen.getByRole('button', { name: 'Next slide' }));
    expect(audio?.currentTime).toBe(1.2);
    await user.click(screen.getByRole('button', { name: 'Jump to slide 3: Slide 3' }));
    expect(screen.getByText('3 / 3')).toBeInTheDocument();
    expect(audio?.currentTime).toBe(1.2);
    await user.click(screen.getByRole('button', { name: 'Jump to slide 1: Slide 1' }));
    expect(audio?.currentTime).toBe(0);
    await user.click(screen.getByRole('button', { name: 'Jump to slide 2: Slide 2' }));
    expect(audio?.currentTime).toBe(1.2);
    expect(document.querySelector('.public-deck-playback-progress')).toHaveStyle({
      '--public-deck-progress': '25%',
    });
    await user.click(screen.getByRole('button', { name: 'Present slide fullscreen' }));
    expect(screen.getByLabelText('Public presentation')).toHaveClass(
      'public-deck-viewer-slide-fullscreen',
    );
    expect(screen.queryByRole('region', { name: 'Presentation playback' })).not.toBeInTheDocument();
    act(() => {
      void document.exitFullscreen();
    });
    await waitFor(() => {
      expect(screen.getByRole('region', { name: 'Presentation playback' })).toBeInTheDocument();
    });
    audio = document.querySelector('audio');
    expect(audio).toBeInstanceOf(HTMLAudioElement);
    await user.click(screen.getByRole('button', { name: 'Play presentation audio' }));
    expect(screen.getByRole('button', { name: 'Pause presentation audio' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Show captions' }));
    expect(screen.getByText('The second slide has synced audio.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Jump to slide 3: Slide 3' }));
    expect(screen.queryByText('The second slide has synced audio.')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Jump to slide 2: Slide 2' }));
    expect(screen.getByRole('button', { name: 'Open transcript chat' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Open presentation AI' }));

    expect(screen.getByRole('complementary', { name: 'Transcript chat' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Podcast playback' })).toBeInTheDocument();
    expect(screen.getByLabelText('Presentation slides')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open slide 1: Slide 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open slide 2: Slide 2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open slide 3: Slide 3' })).toBeInTheDocument();
    expect(screen.getByText('Podcast mode')).toBeInTheDocument();
    expect(screen.getByLabelText('Podcast recording')).toHaveValue('recording1');
    await waitFor(() => {
      expect(screen.getByLabelText('Podcast audio time')).toHaveTextContent('0:010:02');
    });
    expect(screen.queryByLabelText('Presenter recording audio')).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Ask' })).not.toBeInTheDocument();
    expect(screen.getByRole('form', { name: 'Transcript question prompt' })).toHaveClass('prompt-bar');
    expect(screen.getByRole('textbox', { name: 'Question for transcript chat' }).tagName).toBe('TEXTAREA');
    const transcriptModelSelect = await screen.findByRole('combobox', {
      name: 'Transcript answer model',
    });
    expect(transcriptModelSelect).toHaveValue(browserPromptService.CHROME_PROMPT_PROVIDER_ID);
    expect(Array.from((transcriptModelSelect as HTMLSelectElement).options)).toEqual([
      expect.objectContaining({
        text: 'Chrome Built-in Prompt API',
        value: browserPromptService.CHROME_PROMPT_PROVIDER_ID,
      }),
      expect.objectContaining({
        text: aiModelCatalog.GEMMA_LLM_DISPLAY_NAME,
        value: browserPromptService.GEMMA_PROMPT_PROVIDER_ID,
      }),
    ]);
    await user.selectOptions(
      transcriptModelSelect,
      browserPromptService.GEMMA_PROMPT_PROVIDER_ID,
    );
    await waitFor(() => {
      expect(transcriptModelSelect).toHaveValue(browserPromptService.GEMMA_PROMPT_PROVIDER_ID);
    });
    expect(
      screen.getByRole('button', { name: `Download ${aiModelCatalog.GEMMA_LLM_DISPLAY_NAME}` }),
    ).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Summarize this presentation in 3 bullets' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Presenter recording' })).toBeInTheDocument();
    expect(screen.getByText('The roadmap includes transcript chat.')).toBeInTheDocument();
    expect(screen.getAllByText('The second slide has synced audio.')).toHaveLength(2);
    const panelAudio = document.querySelectorAll('audio')[1];
    expect(panelAudio).toBeInstanceOf(HTMLAudioElement);
    await user.click(screen.getByRole('button', { name: 'Open slide 1: Slide 1' }));
    expect(panelAudio?.currentTime).toBe(0);
    await user.click(screen.getByRole('button', { name: 'Play slide 2' }));
    expect(panelAudio?.currentTime).toBe(1.2);
    await waitFor(() => {
      expect(screen.getByText('2 / 3')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Pause slide 2' })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Pause presentation audio' })).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(audio?.currentTime).toBe(1.2);
    });
    act(() => {
      if (!panelAudio) return;
      panelAudio.currentTime = 2.4;
      panelAudio.dispatchEvent(new Event('timeupdate'));
    });
    await waitFor(() => {
      expect(screen.getByText('0:02 / 0:02')).toBeInTheDocument();
    });
    await user.click(
      screen.getByRole('button', { name: 'Play transcript segment for slide 2 at 0:01' }),
    );
    expect(panelAudio?.currentTime).toBe(1.2);
    act(() => {
      if (!audio) return;
      audio.currentTime = 2.4;
      audio.dispatchEvent(new Event('timeupdate'));
    });
    await waitFor(() => {
      expect(screen.getByLabelText('Podcast audio time')).toHaveTextContent('0:020:02');
    });
    expect(
      screen
        .getByRole('button', { name: 'Play transcript segment for slide 2 at 0:01' })
        .closest('li'),
    ).toHaveClass('public-transcript-segment-active-slide');
  });

  it('starts public share routes on the media preparation progress UI', () => {
    const deferredShare = createDeferredResponse();
    const sourceUrl =
      'http://localhost:9000/localstudio/mirrors/public-shares/00000000-0000-4000-8000-000000000208/share.json';
    window.history.replaceState(
      {},
      '',
      `/editor/s/00000000-0000-4000-8000-000000000208?src=${encodeURIComponent(sourceUrl)}`,
    );
    const shareService = new BrowserShareService({
      fetch: vi.fn(() => deferredShare.promise),
    });

    render(
      <PublicDeckViewer
        shareId="00000000-0000-4000-8000-000000000208"
        fontImportService={fontImportService}
        shareService={shareService}
      />,
    );

    expect(screen.getByLabelText('Preparing shared deck')).toBeInTheDocument();
    expect(screen.getByText('Checking assets')).toBeInTheDocument();
    expect(screen.queryByText('Loading deck...')).not.toBeInTheDocument();
  });

  it('preloads public deck assets in the browser after the share record loads', async () => {
    const project = sampleProject.createSampleProject();
    project.assets['remote-image'] = {
      id: 'remote-image',
      type: 'image',
      name: 'Remote image',
      mimeType: 'image/png',
      objectUrl: 'https://cdn.localstudio.test/assets/remote-image.png',
      storage: 'remote',
    };
    project.assets['remote-video'] = {
      id: 'remote-video',
      type: 'video',
      name: 'Remote video',
      mimeType: 'video/mp4',
      objectUrl: 'https://cdn.localstudio.test/assets/remote-video.mp4',
      storage: 'remote',
    };
    project.assets['remote-gif'] = {
      id: 'remote-gif',
      type: 'gif',
      name: 'Remote GIF',
      mimeType: 'image/gif',
      objectUrl: 'https://cdn.localstudio.test/assets/remote-loop.gif',
      storage: 'remote',
    };
    project.fonts = {
      brand: {
        id: 'brand',
        family: 'Brand Sans',
        requestedFamily: 'Brand Sans',
        source: 'uploaded',
        fontStyle: 'normal',
        fontWeight: 700,
        mimeType: 'font/woff2',
        fileName: 'brand.woff2',
        storage: 'remote',
        objectUrl: 'https://cdn.localstudio.test/fonts/brand.woff2',
      },
    };
    const preloadImageSpy = vi.spyOn(canvasWorkspaceUtils, 'preloadCanvasImage');
    const preloadFetch = vi.mocked(globalThis.fetch);
    const { share, shareService } = createRemoteShare(
      '00000000-0000-4000-8000-000000000206',
      project,
    );

    render(
      <PublicDeckViewer
        shareId={share.shareId}
        fontImportService={fontImportService}
        shareService={shareService}
      />,
    );

    await screen.findByLabelText('Public presentation');
    await waitFor(() => {
      expect(preloadImageSpy).toHaveBeenCalledWith(
        'https://cdn.localstudio.test/assets/remote-image.png',
      );
      expect(preloadImageSpy).toHaveBeenCalledWith(
        'https://cdn.localstudio.test/assets/remote-loop.gif',
      );
      expect(preloadedVideoUrls).toContain('https://cdn.localstudio.test/assets/remote-video.mp4');
      expect(preloadFetch).toHaveBeenCalledWith(
        'https://cdn.localstudio.test/fonts/brand.woff2',
        expect.objectContaining({
          cache: 'force-cache',
          credentials: 'omit',
          mode: 'cors',
        }),
      );
    });
  });

  it('keeps the loading screen until every public deck asset has been preloaded', async () => {
    const project = sampleProject.createBlankProject();
    project.fonts = Object.fromEntries(
      Array.from({ length: 4 }, (_, index) => [
        `remote-font-${index}`,
        {
          family: `Remote Font ${index}`,
          fileName: `remote-font-${index}.woff2`,
          fontStyle: 'normal' as const,
          fontWeight: 400,
          id: `remote-font-${index}`,
          mimeType: 'font/woff2' as const,
          objectUrl: `https://cdn.localstudio.test/fonts/remote-font-${index}.woff2`,
          requestedFamily: `Remote Font ${index}`,
          source: 'uploaded' as const,
          storage: 'remote' as const,
        },
      ]),
    );
    const deferredResponses = Array.from({ length: 4 }, () => createDeferredResponse());
    let nextResponseIndex = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        const response = deferredResponses[nextResponseIndex];
        nextResponseIndex += 1;
        return response!.promise;
      }),
    );
    const { share, shareService } = createRemoteShare(
      '00000000-0000-4000-8000-000000000207',
      project,
    );

    render(
      <PublicDeckViewer
        shareId={share.shareId}
        fontImportService={fontImportService}
        shareService={shareService}
      />,
    );

    expect(await screen.findByLabelText('Preparing shared deck')).toBeInTheDocument();
    act(() => {
      deferredResponses[0]!.resolve(new Response(null, { status: 204 }));
    });
    expect(await screen.findByText('1 / 4 assets ready')).toBeInTheDocument();
    expect(screen.queryByLabelText('Public presentation')).not.toBeInTheDocument();

    act(() => {
      deferredResponses[1]!.resolve(new Response(null, { status: 204 }));
    });
    expect(await screen.findByText('2 / 4 assets ready')).toBeInTheDocument();
    expect(screen.queryByLabelText('Public presentation')).not.toBeInTheDocument();

    act(() => {
      deferredResponses[2]!.resolve(new Response(null, { status: 204 }));
    });
    expect(await screen.findByText('3 / 4 assets ready')).toBeInTheDocument();
    expect(screen.queryByLabelText('Public presentation')).not.toBeInTheDocument();

    act(() => {
      deferredResponses[3]!.resolve(new Response(null, { status: 204 }));
    });
    expect(await screen.findByLabelText('Public presentation')).toBeInTheDocument();
  });

  it('keeps embeds in a compact shared deck layout', async () => {
    const { share, shareService } = createRemoteShare('00000000-0000-4000-8000-000000000202');

    render(
      <PublicDeckViewer
        shareId={share.shareId}
        fontImportService={fontImportService}
        shareService={shareService}
        embed
      />,
    );

    expect(await screen.findByLabelText('Embedded shared deck')).toHaveClass('public-deck-viewer-embed');
    expect(screen.getByLabelText('Embedded shared deck')).not.toHaveClass('public-deck-viewer-present');
  });

  it('moves between slides with next and previous controls', async () => {
    const user = userEvent.setup();
    const project = sampleProject.createSampleProject();
    project.pages.push({
      id: 'page-2',
      name: 'Slide 2',
      width: 1920,
      height: 1080,
      background: { type: 'color', color: '#111111' },
      elementIds: [],
    });
    const { share, shareService } = createRemoteShare(
      '00000000-0000-4000-8000-000000000203',
      project,
    );

    render(
      <PublicDeckViewer
        shareId={share.shareId}
        fontImportService={fontImportService}
        shareService={shareService}
      />,
    );

    expect(await screen.findByText('1 / 2')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next slide' }));
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next slide' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Previous slide' }));
    expect(screen.getByText('1 / 2')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Jump to slide 2: Slide 2' }));
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Jump to slide 2: Slide 2' })).toHaveAttribute(
      'aria-current',
      'page',
    );

    const previousButton = screen.getByRole('button', { name: 'Previous slide' });
    previousButton.focus();
    expect(previousButton).toHaveFocus();
    await user.keyboard(' ');
    expect(screen.getByText('1 / 2')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show keyboard shortcuts' }));
    expect(screen.getByRole('dialog', { name: 'Keyboard Shortcuts' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Advance to next build/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Go to first slide/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Pause\/Play movie/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Jump to end of movie/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Go to first slide/ }));
    expect(screen.getByText('1 / 2')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'End' });
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Home' });
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: '?' });
    expect(screen.queryByRole('dialog', { name: 'Keyboard Shortcuts' })).not.toBeInTheDocument();
    fireEvent.keyDown(window, { key: '?' });
    expect(screen.getByRole('dialog', { name: 'Keyboard Shortcuts' })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Keyboard Shortcuts' })).not.toBeInTheDocument();

    expect(screen.queryByRole('button', { name: 'Open transcript chat' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Open slide list' }));
    const slideList = screen.getByRole('complementary', { name: 'Slide list' });
    expect(slideList).toBeInTheDocument();
    expect(slideList).toContainElement(
      screen.getByRole('button', { name: 'Open slide 2: Slide 2' }),
    );
    await user.click(screen.getByRole('button', { name: 'Open slide 2: Slide 2' }));
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
    expect(screen.queryByRole('complementary', { name: 'Slide list' })).not.toBeInTheDocument();
  });

  it('waits for target slide videos and GIFs before changing public deck slides', async () => {
    const user = userEvent.setup();
    const project = sampleProject.createSampleProject();
    project.assets['remote-slide-video'] = {
      id: 'remote-slide-video',
      type: 'video',
      name: 'Slide video',
      mimeType: 'video/mp4',
      objectUrl: 'https://cdn.localstudio.test/assets/slide-video.mp4',
      storage: 'remote',
    };
    project.assets['remote-slide-gif'] = {
      id: 'remote-slide-gif',
      type: 'gif',
      name: 'Slide GIF',
      mimeType: 'image/gif',
      objectUrl: 'https://cdn.localstudio.test/assets/slide-loop.gif',
      storage: 'remote',
    };
    project.elements['video-slide'] = {
      assetId: 'remote-slide-video',
      autoplayInPreview: false,
      controls: false,
      height: 360,
      id: 'video-slide',
      locked: false,
      loop: false,
      muted: true,
      opacity: 1,
      playAcrossSlides: false,
      repeatMode: 'none',
      rotation: 0,
      startOnClick: false,
      trimStartSeconds: 0,
      type: 'video',
      visible: true,
      volume: 1,
      width: 640,
      x: 200,
      y: 200,
    };
    project.elements['gif-slide'] = {
      assetId: 'remote-slide-gif',
      height: 240,
      id: 'gif-slide',
      locked: false,
      opacity: 1,
      playing: true,
      rotation: 0,
      type: 'gif',
      visible: true,
      width: 320,
      x: 900,
      y: 200,
    };
    project.pages.push({
      id: 'page-2',
      name: 'Slide 2',
      width: 1920,
      height: 1080,
      background: { type: 'color', color: '#111111' },
      elementIds: ['video-slide', 'gif-slide'],
    });
    const { share, shareService } = createRemoteShare(
      '00000000-0000-4000-8000-000000000209',
      project,
    );

    render(
      <PublicDeckViewer
        shareId={share.shareId}
        fontImportService={fontImportService}
        shareService={shareService}
      />,
    );

    expect(await screen.findByText('1 / 2')).toBeInTheDocument();
    let releaseTargetSlideGif: (() => void) | undefined;
    let releaseTargetSlideVideo: (() => void) | undefined;
    class DelayedTargetSlideImage extends EventTarget {
      naturalHeight = 480;
      naturalWidth = 640;
      private imageSrc = '';

      get src() {
        return this.imageSrc;
      }

      set src(value: string) {
        this.imageSrc = value;
        if (value.includes('slide-loop.gif')) {
          releaseTargetSlideGif = () => {
            this.dispatchEvent(new Event('load'));
          };
          return;
        }
        queueMicrotask(() => {
          this.dispatchEvent(new Event('load'));
        });
      }
    }
    vi.stubGlobal('Image', DelayedTargetSlideImage);
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(function loadMedia(
      this: HTMLMediaElement,
    ) {
      if (this instanceof HTMLVideoElement && this.src.includes('slide-video.mp4')) {
        releaseTargetSlideVideo = () => {
          this.dispatchEvent(new Event('loadeddata'));
        };
      }
    });

    await user.click(screen.getByRole('button', { name: 'Next slide' }));
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
    expect(screen.queryByText('2 / 2')).not.toBeInTheDocument();

    act(() => {
      releaseTargetSlideVideo?.();
    });
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
    expect(screen.queryByText('2 / 2')).not.toBeInTheDocument();

    act(() => {
      releaseTargetSlideGif?.();
    });

    expect(await screen.findByText('2 / 2')).toBeInTheDocument();

    const presentedVideo = screen.getByLabelText<HTMLVideoElement>('Slide video');
    const preloadedVideo = document.querySelector<HTMLVideoElement>(
      '.project-video-preloader video',
    );
    expect(preloadedVideo).not.toBeNull();
    let presentedVideoPaused = true;
    const playPresentedVideo = vi.fn(() => {
      presentedVideoPaused = false;
      return Promise.resolve();
    });
    const pausePresentedVideo = vi.fn(() => {
      presentedVideoPaused = true;
    });
    const playPreloadedVideo = vi.fn(() => Promise.resolve());
    Object.defineProperty(presentedVideo, 'paused', {
      configurable: true,
      get: () => presentedVideoPaused,
    });
    Object.defineProperty(presentedVideo, 'play', {
      configurable: true,
      value: playPresentedVideo,
    });
    Object.defineProperty(presentedVideo, 'pause', {
      configurable: true,
      value: pausePresentedVideo,
    });
    Object.defineProperty(preloadedVideo, 'play', {
      configurable: true,
      value: playPreloadedVideo,
    });

    fireEvent.keyDown(window, { key: 'k' });
    expect(playPresentedVideo).toHaveBeenCalledOnce();
    expect(playPreloadedVideo).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: 'k' });
    expect(pausePresentedVideo).toHaveBeenCalledOnce();

    await user.click(screen.getByRole('button', { name: 'Show keyboard shortcuts' }));
    expect(screen.queryByRole('button', { name: /Quit presentation mode/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Close the slide navigator/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Pause\/Play movie/ }));
    expect(playPresentedVideo).toHaveBeenCalledTimes(2);
    expect(playPreloadedVideo).not.toHaveBeenCalled();
  });

  it('rewinds shared deck slides with the left arrow key after advancing', async () => {
    const project = sampleProject.createSampleProject();
    project.pages.push({
      id: 'page-2',
      name: 'Slide 2',
      width: 1920,
      height: 1080,
      background: { type: 'color', color: '#111111' },
      elementIds: [],
    });
    const { share, shareService } = createRemoteShare(
      '00000000-0000-4000-8000-000000000205',
      project,
    );

    render(
      <PublicDeckViewer
        shareId={share.shareId}
        fontImportService={fontImportService}
        shareService={shareService}
      />,
    );

    expect(await screen.findByText('1 / 2')).toBeInTheDocument();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByText('2 / 2')).toBeInTheDocument();

    await userEvent.keyboard('{ArrowLeft}');
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
  });

  it('starts shared decks in presenter animation playback mode', async () => {
    const project = sampleProject.createSampleProject();
    project.pages[0]!.animationBuilds = [
      {
        id: 'animation-title',
        elementId: 'text-title',
        effect: 'reveal',
        trigger: 'on-click',
        delayMs: 0,
      },
    ];
    const { share, shareService } = createRemoteShare(
      '00000000-0000-4000-8000-000000000204',
      project,
    );

    render(
      <PublicDeckViewer
        shareId={share.shareId}
        fontImportService={fontImportService}
        shareService={shareService}
      />,
    );

    const slideCanvas = await screen.findByLabelText('Slide canvas');
    expect(slideCanvas).toHaveAttribute('data-animation-preview', 'playing');
    expect(slideCanvas).toHaveAttribute('data-animation-preview-mode', 'presenter');
    await waitFor(() => {
      expect(slideCanvas).toHaveAttribute('data-animation-preview-phase', 'waiting');
      expect(slideCanvas).toHaveAttribute('data-animation-preview-waiting', 'true');
    });
  });

  it('shows a not found state for missing shares', async () => {
    window.history.replaceState(
      {},
      '',
      '/editor/s/missing-share?src=http%3A%2F%2Flocalhost%3A9000%2Flocalstudio%2Fmissing.json',
    );
    const shareService = new BrowserShareService({
      fetch: vi.fn(() => Promise.resolve(new Response(null, { status: 404 }))),
    });

    render(
      <PublicDeckViewer
        shareId="missing-share"
        fontImportService={fontImportService}
        shareService={shareService}
      />,
    );

    expect(await screen.findByRole('heading', { name: 'Deck not found' })).toBeInTheDocument();
  });
});
