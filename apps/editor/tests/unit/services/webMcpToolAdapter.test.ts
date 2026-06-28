import { imagePromptExamples, slidePromptExamples } from '../../../src/ui/editor/promptRecipes';
import { WebMcpToolAdapter, type WebMcpTool } from '../../../src/services/webMcpToolAdapter';

describe('WebMcpToolAdapter', () => {
  it('registers discoverable WebMCP tools with prompt examples in metadata', () => {
    const registerTools = vi.fn<(tools: WebMcpTool[]) => void>();
    const adapter = new WebMcpToolAdapter({
      createProject: vi.fn(),
      generateSlides: vi.fn(),
      generateImage: vi.fn(),
      translateText: vi.fn(),
      getProjectSnapshot: vi.fn(),
    });

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
    expect(generateSlidesTool?.description).toContain(slidePromptExamples[0]);
    expect(generateImageTool?.description).toContain(imagePromptExamples[0]);
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
