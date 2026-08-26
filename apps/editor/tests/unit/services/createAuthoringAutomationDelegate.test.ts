import { sampleProject } from '../../../src/domain/projects/sampleProject';
import { createAuthoringAutomationDelegate } from '../../../src/services/automation/createAuthoringAutomationDelegate';
import type {
  FontImportRequest,
  FontImportService,
} from '../../../src/services/contracts/interfaces';

function createHarness() {
  let project = sampleProject.createBlankProject();
  const resolveAndDownloadFonts = vi.fn((requests: FontImportRequest[]) =>
    Promise.resolve({
      fonts: Object.fromEntries(
        requests.map((request) => [
          request.family,
          {
            id: `font-${request.family}`,
            family: request.family,
            source: 'google-fonts' as const,
            requestedFamily: request.family,
            fontStyle: request.fontStyle,
            fontWeight: request.fontWeight,
            mimeType: 'font/woff2' as const,
            fileName: `${request.family}.woff2`,
            storage: 'remote' as const,
            sourceUrl: `https://fonts.example/${request.family}.woff2`,
          },
        ]),
      ),
      resolutions: requests.map((request) => ({
        requestedFamily: request.family,
        family: request.family,
        fontStyle: request.fontStyle,
        fontWeight: request.fontWeight,
        status: 'downloaded-exact' as const,
      })),
      warnings: [],
    }),
  );
  const fontImportService: FontImportService = {
    listDownloadableFonts: vi.fn(() => []),
    resolveAndDownloadFonts,
    loadProjectFonts: vi.fn(() => Promise.resolve()),
  };
  const delegate = createAuthoringAutomationDelegate({
    fontImportService,
    getProject: () => project,
    replaceProject: (nextProject) => {
      project = nextProject;
    },
    applyProject: (nextProject) => {
      project = nextProject;
    },
  });
  return { delegate, resolveAndDownloadFonts, getProject: () => project };
}

describe('createAuthoringAutomationDelegate', () => {
  it('creates a named 1920x1080 presentation and returns bounded state', async () => {
    const harness = createHarness();

    expect(await harness.delegate.createPresentation({ name: 'Agent Deck' })).toMatchObject({
      name: 'Agent Deck',
      width: 1920,
      height: 1080,
      slideId: 'page-1',
    });
    expect(await harness.delegate.getPresentationState({ detail: 'summary' })).toMatchObject({
      name: 'Agent Deck',
      pageCount: 1,
      slides: [{ slideNumber: 1, descriptionFreshness: 'missing' }],
    });
    expect(() => harness.delegate.createPresentation({ width: 0 })).toThrow(
      'dimensions must be positive',
    );
  });

  it('paginates detailed elements without returning an unbounded slide payload', async () => {
    const harness = createHarness();
    const elements = ['one', 'two', 'three'].map((elementId, index) => ({
      elementId,
      type: 'text' as const,
      frame: { x: index * 100, y: 0, width: 90, height: 50 },
      zIndex: index,
      content: { text: elementId },
      style: { fontFamily: 'Arial', fontSize: 20, fontWeight: 400, color: '#000000' },
    }));
    await harness.delegate.upsertSlideContent({
      requestId: 'state-pagination',
      slideNumber: 1,
      mode: 'replace',
      elements,
    });

    expect(
      await harness.delegate.getPresentationState({
        detail: 'elements',
        slideNumbers: [1],
        elementLimit: 2,
      }),
    ).toMatchObject({
      slides: [{ elements: [{ id: 'one' }, { id: 'two' }], nextElementCursor: 2 }],
    });
  });

  it('reports a description as stale when its source revision no longer matches the slide', async () => {
    const harness = createHarness();
    const initialState = (await harness.delegate.getPresentationState({ detail: 'summary' })) as {
      slides: Array<{ revision: string }>;
    };
    const page = harness.getProject().pages[0];
    if (!page) throw new Error('Expected a first page.');
    page.semanticDescription = {
      text: 'An old description',
      language: 'en',
      generatedAt: '2026-08-26T00:00:00.000Z',
      generator: 'test',
      sourceRevision: initialState.slides[0]?.revision ?? '',
      reviewed: false,
      stale: false,
    };

    expect(await harness.delegate.getPresentationState({ detail: 'summary' })).toMatchObject({
      slides: [{ slideNumber: 1, descriptionFreshness: 'fresh' }],
    });
    page.name = 'Changed after description generation';
    expect(await harness.delegate.getPresentationState({ detail: 'summary' })).toMatchObject({
      slides: [{ slideNumber: 1, descriptionFreshness: 'stale' }],
    });
  });

  it('downloads an available referenced font before applying the exact text element', async () => {
    const harness = createHarness();

    await harness.delegate.upsertSlideContent({
      requestId: 'font-upsert',
      slideNumber: 1,
      mode: 'replace',
      elements: [
        {
          elementId: 'title',
          type: 'text',
          frame: { x: 10, y: 20, width: 500, height: 100 },
          zIndex: 1,
          content: { text: 'Exact slide' },
          style: { fontFamily: 'Roboto Slab', fontSize: 48, fontWeight: 700, color: '#123456' },
        },
      ],
    });

    expect(harness.resolveAndDownloadFonts).toHaveBeenCalledWith([
      { family: 'Roboto Slab', fontStyle: 'normal', fontWeight: 700 },
    ]);
    expect(harness.getProject().elements.title).toMatchObject({
      text: 'Exact slide',
      x: 10,
      y: 20,
      fontFamily: 'Roboto Slab',
      fill: '#123456',
    });
  });

  it('rejects unsafe media URLs without changing the project', async () => {
    const harness = createHarness();
    const original = harness.getProject();

    await expect(
      harness.delegate.upsertSlideContent({
        requestId: 'unsafe-media',
        slideNumber: 1,
        mode: 'replace',
        elements: [
          {
            elementId: 'image',
            type: 'image',
            frame: { x: 0, y: 0, width: 100, height: 100 },
            zIndex: 0,
            content: { url: 'file:///tmp/private.png' },
          },
        ],
      }),
    ).rejects.toThrow('Only HTTP and HTTPS');
    expect(harness.getProject()).toBe(original);
  });
});
