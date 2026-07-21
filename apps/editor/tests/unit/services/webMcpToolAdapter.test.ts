import { promptRecipes } from '../../../src/ui/editor/prompting/promptRecipes';
import { WebMcpToolAdapter, type WebMcpTool } from '../../../src/services/webmcp/webMcpToolAdapter';

describe('WebMcpToolAdapter', () => {
  function createAdapter() {
    return new WebMcpToolAdapter({
      createProject: vi.fn(),
      generateSlides: vi.fn(),
      generateImage: vi.fn(),
      translateText: vi.fn(),
      getProjectSnapshot: vi.fn(),
    });
  }

  it('registers discoverable WebMCP tools with prompt examples in metadata', () => {
    const registerTools = vi.fn<(tools: WebMcpTool[]) => void>();
    const adapter = createAdapter();

    adapter.register({ registerTools });

    const tools = registerTools.mock.calls[0]?.[0] ?? [];
    expect(tools).toHaveLength(5);
    expect(tools.map((tool) => tool.name)).toEqual([
      'create_project',
      'generate_slides',
      'generate_image',
      'translate_text',
      'get_project_snapshot',
    ]);
    const generateSlidesTool = tools.find((tool) => tool.name === 'generate_slides');
    const generateImageTool = tools.find((tool) => tool.name === 'generate_image');
    expect(generateSlidesTool?.description).toContain(promptRecipes.slidePromptExamples[0]);
    expect(generateImageTool?.description).toContain(promptRecipes.imagePromptExamples[0]);
  });

  it('runs WebMCP cleanup callbacks returned by the browser runtime', () => {
    const cleanup = vi.fn();
    const adapter = createAdapter();
    const unregister = adapter.register({
      registerTools: vi.fn(() => cleanup),
    });

    unregister();

    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('ignores duplicate WebMCP tool registration errors from an existing runtime registration', () => {
    const adapter = createAdapter();
    const registerTool = vi.fn(() => {
      throw new DOMException('Duplicate tool name', 'InvalidStateError');
    });

    expect(() => adapter.register({ registerTool })).not.toThrow();
    expect(registerTool).toHaveBeenCalledTimes(5);
  });

  it('forwards tool calls to the automation controller', async () => {
    const generateSlides = vi.fn(() =>
      Promise.resolve({ ok: true as const, data: { snapshot: { projectId: 'project-1' } as never } }),
    );
    const registerTools = vi.fn<(tools: WebMcpTool[]) => void>();
    const adapter = new WebMcpToolAdapter({
      createProject: vi.fn(),
      generateSlides,
      generateImage: vi.fn(),
      translateText: vi.fn(),
      getProjectSnapshot: vi.fn(),
    });

    adapter.register({ registerTools });
    const tools = registerTools.mock.calls[0]?.[0] ?? [];
    const generateSlidesTool = tools.find((tool) => tool.name === 'generate_slides');

    await expect(generateSlidesTool?.execute({ prompt: 'Three-image grid about Web AI, with matching captions.' })).resolves.toEqual({
      ok: true,
      data: { snapshot: { projectId: 'project-1' } },
    });
    expect(generateSlides).toHaveBeenCalledWith({
      prompt: 'Three-image grid about Web AI, with matching captions.',
    });
  });
});
