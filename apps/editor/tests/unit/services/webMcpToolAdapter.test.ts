import { authoringAutomationController } from '../../../src/services/automation/authoringAutomationController';
import type { AuthoringAutomationDelegate } from '../../../src/services/automation/authoringAutomationController';
import { WebMcpToolAdapter, type WebMcpTool } from '../../../src/services/webmcp/webMcpToolAdapter';

const expectedToolNames = [
  'create_presentation',
  'get_presentation_state',
  'import_powerpoint_from_url',
  'translate_deck_and_notes',
  'generate_deck_detailed_description',
  'list_authoring_catalog',
  'upsert_slide_content',
  'generate_image',
  'get_slide_preview',
  'get_ai_model_status',
  'prepare_ai_models',
  'search_media',
  'export_presentation',
  'get_operation_status',
];

function createDelegate(
  overrides: Partial<AuthoringAutomationDelegate> = {},
): AuthoringAutomationDelegate {
  return {
    createPresentation: vi.fn(() => ({ projectId: 'project-1', name: 'Untitled' })),
    getPresentationState: vi.fn(() => ({ projectId: 'project-1', pageCount: 1 })),
    importPowerPointFromUrl: vi.fn(() => Promise.resolve({ pageCount: 1 })),
    translateDeckAndNotes: vi.fn(() => Promise.resolve({ translatedPageIds: [] })),
    generateDeckDetailedDescription: vi.fn(() => Promise.resolve({ describedSlides: 1 })),
    listAuthoringCatalog: vi.fn(() => ({ fonts: [] })),
    upsertSlideContent: vi.fn(() => Promise.reject(new Error('not used'))),
    generateImage: vi.fn(() => Promise.resolve({ assetId: 'asset-1' })),
    getSlidePreview: vi.fn(() => ({ slideId: 'page-1' })),
    getAiModelStatus: vi.fn(() => Promise.resolve({ models: [] })),
    prepareAiModels: vi.fn(() => Promise.resolve([])),
    searchMedia: vi.fn(() => Promise.resolve({ results: [] })),
    exportPresentation: vi.fn(() => Promise.resolve({ fileName: 'deck.pptx' })),
    ...overrides,
  };
}

function createAdapter(delegate = createDelegate()) {
  return new WebMcpToolAdapter(
    new authoringAutomationController.AuthoringAutomationController(delegate),
  );
}

describe('WebMcpToolAdapter', () => {
  it('registers only the refined authoring catalog with safety metadata', () => {
    const registerTools = vi.fn<(tools: WebMcpTool[]) => void>();
    createAdapter().register({ registerTools });

    const tools = registerTools.mock.calls[0]?.[0] ?? [];
    expect(tools.map((tool) => tool.name)).toEqual(expectedToolNames);
    expect(tools).toHaveLength(14);
    expect(tools.every((tool) => Boolean(tool.title))).toBe(true);
    expect(tools.every((tool) => tool.annotations?.untrustedContentHint)).toBe(true);
    expect(tools.find((tool) => tool.name === 'generate_image')?.description).toContain(
      'upsert_slide_content',
    );
    expect(tools.find((tool) => tool.name === 'get_slide_preview')?.annotations?.readOnlyHint).toBe(
      false,
    );
  });

  it('runs cleanup callbacks returned by the browser runtime', () => {
    const cleanup = vi.fn();
    const unregister = createAdapter().register({ registerTools: vi.fn(() => cleanup) });

    unregister();

    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('ignores duplicate tool registration errors', () => {
    const registerTool = vi.fn(() => {
      throw new DOMException('Duplicate tool name', 'InvalidStateError');
    });

    expect(() => createAdapter().register({ registerTool })).not.toThrow();
    expect(registerTool).toHaveBeenCalledTimes(14);
  });

  it('normalizes create presentation input before forwarding it', async () => {
    const createPresentation = vi.fn(() => ({ projectId: 'project-1', name: 'WebMCP Deck' }));
    const adapter = createAdapter(createDelegate({ createPresentation }));
    const tool = adapter
      .createTools()
      .find((candidate) => candidate.name === 'create_presentation');

    await expect(tool?.execute({ name: 'WebMCP Deck', width: 1600, height: 900 })).resolves.toEqual(
      {
        ok: true,
        data: { projectId: 'project-1', name: 'WebMCP Deck' },
      },
    );
    expect(createPresentation).toHaveBeenCalledWith({
      name: 'WebMCP Deck',
      width: 1600,
      height: 900,
    });
  });

  it('publishes a strict discriminated schema for slide upserts', () => {
    const tool = createAdapter()
      .createTools()
      .find((candidate) => candidate.name === 'upsert_slide_content');
    const schema = tool?.inputSchema as {
      additionalProperties?: boolean;
      oneOf?: unknown[];
      properties?: { elements?: { items?: { oneOf?: unknown[] } } };
    };

    expect(schema.additionalProperties).toBe(false);
    expect(schema.oneOf).toHaveLength(2);
    expect(schema.properties?.elements?.items?.oneOf).toHaveLength(5);
  });

  it('rejects invalid local-bridge input before dispatch', async () => {
    const createPresentation = vi.fn(() => ({ projectId: 'project-1', name: 'WebMCP Deck' }));
    const tool = createAdapter(createDelegate({ createPresentation }))
      .createTools()
      .find((candidate) => candidate.name === 'create_presentation');

    expect(await tool?.execute({ width: 0, unexpected: true })).toEqual({
      ok: false,
      errorCode: 'invalid_input',
      message: 'input.unexpected is not allowed.',
    });
    expect(createPresentation).not.toHaveBeenCalled();
  });

  it('enforces nested slide-upsert bounds and discriminated shapes', async () => {
    const upsertSlideContent = vi.fn<AuthoringAutomationDelegate['upsertSlideContent']>(() =>
      Promise.reject(new Error('not used')),
    );
    const tool = createAdapter(createDelegate({ upsertSlideContent }))
      .createTools()
      .find((candidate) => candidate.name === 'upsert_slide_content');

    expect(
      await tool?.execute({
        requestId: 'invalid-upsert',
        mode: 'replace',
        slideId: 'slide-1',
        slideNumber: 1,
        elements: [],
      }),
    ).toMatchObject({
      ok: false,
      errorCode: 'invalid_input',
    });
    expect(upsertSlideContent).not.toHaveBeenCalled();
  });
});
