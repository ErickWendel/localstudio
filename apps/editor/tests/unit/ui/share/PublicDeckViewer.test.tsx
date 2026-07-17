import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sampleProject } from '../../../../src/domain/projects/sampleProject';
import type {
  FontImportResult,
  FontImportService,
  ShareRecord,
} from '../../../../src/services/contracts/interfaces';
import { BrowserShareService } from '../../../../src/services/sharing/shareService';
import { PublicDeckViewer } from '../../../../src/ui/share/PublicDeckViewer';

describe('PublicDeckViewer', () => {
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
    window.history.replaceState({}, '', '/');
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(null, { status: 204 }))));
  });

  afterEach(() => {
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
    expect(screen.getByText('1 / 1')).toBeInTheDocument();
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
      expect(preloadFetch).toHaveBeenCalledWith(
        'https://cdn.localstudio.test/assets/remote-image.png',
        expect.objectContaining({
          cache: 'force-cache',
          credentials: 'omit',
          mode: 'cors',
        }),
      );
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
