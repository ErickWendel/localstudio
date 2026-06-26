import { describe, expect, it, vi } from 'vitest';
import type { GeneratedSlideTask } from '../../../src/domain/generatedSlide';
import { GEMMA_LLM_TRANSFORMERS_MODEL_ID } from '../../../src/services/aiModelIds';
import {
  BrowserPromptService,
  createGemmaStructuredJsonMessages,
  GemmaPromptProvider,
  GEMMA_PROMPT_PROVIDER_ID,
} from '../../../src/services/browserPromptService';
import type { ModelSetupService } from '../../../src/services/interfaces';
import type {
  TextGenerationInput,
  TextGenerationOptions,
  TextGenerationRuntime,
} from '../../../src/services/webGpuTextGenerationRuntime';

class TestTextGenerationRuntime implements TextGenerationRuntime {
  preload = vi.fn<() => Promise<void>>(() => Promise.resolve());
  generate = vi.fn<
    (modelId: string, prompt: TextGenerationInput, options?: TextGenerationOptions) => Promise<string>
  >();
}

class ProgressModelSetupService {
  downloadModel = vi.fn((_id: string, options?: { onProgress?: (progress: number) => void }) => {
    options?.onProgress?.(99);
    return Promise.resolve({
      id: 'gemma-4-webgpu-llm',
      label: 'Gemma',
      provider: 'transformers' as const,
      status: 'ready' as const,
      progress: 100,
      required: false,
    });
  });

  getModelStates = vi.fn(() => Promise.resolve([]));
  downloadRequiredModels = vi.fn(() => Promise.resolve([]));
}

describe('GemmaPromptProvider structured JSON generation', () => {
  it('builds chat-style JSON instructions for Gemma', () => {
    const messages = createGemmaStructuredJsonMessages('Create a Web AI slide', { type: 'object' });

    expect(Array.isArray(messages)).toBe(true);
    const [message] = messages as Array<{ role: string; content: string }>;
    expect(message?.role).toBe('user');
    expect(message?.content).toContain('Return exactly one JSON value');
    expect(JSON.stringify(messages)).toContain('Create a Web AI slide');
    expect(JSON.stringify(messages)).toContain('\\"type\\":\\"object\\"');
  });

  it('generates slide tasks using structured chat messages', async () => {
    const runtime = new TestTextGenerationRuntime();
    runtime.generate.mockResolvedValue(JSON.stringify({
      language: 'en',
      page: {
        name: 'Why Web AI Matters',
        width: 1920,
        height: 1080,
        background: { type: 'color', color: '#050D10' },
      },
      tasks: [
        { type: 'set-background', color: '#050D10' },
        { type: 'add-title', id: 'title', text: 'Why Web AI Matters', placementHint: 'top center' },
      ],
    }));
    const provider = new GemmaPromptProvider(runtime);

    const tasks = await provider.generateSlideTasksFromPrompt('A slide about Web AI');

    expect(tasks.tasks).toHaveLength(2);
    const [modelId, promptInput, generationOptions] = runtime.generate.mock.calls[0]!;
    expect(modelId).toBe(GEMMA_LLM_TRANSFORMERS_MODEL_ID);
    expect(generationOptions).toEqual({ max_new_tokens: 3072 });
    expect(Array.isArray(promptInput)).toBe(true);
    const [message] = promptInput as Array<{ role: string; content: string }>;
    expect(message?.role).toBe('user');
    expect(message?.content).toContain('JSON Schema:');
  });

  it('repairs invalid Gemma JSON once before returning slide tasks', async () => {
    const runtime = new TestTextGenerationRuntime();
    runtime.generate
      .mockResolvedValueOnce('Sure, here is the layout: not json')
      .mockResolvedValueOnce(JSON.stringify({
        language: 'en',
        page: {
          name: 'Why Web AI Matters',
          width: 1920,
          height: 1080,
          background: { type: 'color', color: '#050D10' },
        },
        tasks: [{ type: 'add-title', id: 'title', text: 'Why Web AI Matters', placementHint: 'center' }],
      }));
    const provider = new GemmaPromptProvider(runtime);

    const tasks = await provider.generateSlideTasksFromPrompt('A slide about Web AI');

    expect(tasks.tasks).toHaveLength(1);
    expect(runtime.generate).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(runtime.generate.mock.calls[1]?.[1])).toContain('Invalid response to repair');
  });

  it('does not double-map Gemma model setup progress near completion', async () => {
    const runtime = new TestTextGenerationRuntime();
    const provider = new GemmaPromptProvider(runtime);
    const modelSetupService = new ProgressModelSetupService();
    const progress: number[] = [];

    await provider.prepare(modelSetupService, {
      onProgress: (value) => progress.push(value),
    });

    expect(progress).toContain(99);
    expect(progress.at(-1)).toBe(100);
  });

  it('normalizes left-image hero layout geometry after Gemma output', async () => {
    const modelSetupService: ModelSetupService = {
      getModelStates: vi.fn().mockResolvedValue([]),
      downloadRequiredModels: vi.fn().mockResolvedValue([]),
      downloadModel: vi.fn(),
    };
    const runtime: TextGenerationRuntime = {
      preload: vi.fn(),
      generate: vi.fn().mockResolvedValue(JSON.stringify({
        type: 'image',
        id: 'placeholder',
        assetRole: 'placeholder',
        x: 20,
        y: 20,
        width: 200,
        height: 120,
        rotation: 0,
        opacity: 1,
      })),
    };
    const storage = {
      getItem: vi.fn().mockReturnValue(GEMMA_PROMPT_PROVIDER_ID),
      setItem: vi.fn(),
    } as unknown as Storage;
    const service = new BrowserPromptService(modelSetupService, undefined, storage, runtime);
    const allTasks: Array<Exclude<GeneratedSlideTask, { type: 'set-background' }>> = [
      {
        type: 'add-placeholder-image',
        id: 'placeholder',
        description: 'Hero placeholder image',
        placementHint: 'hero placeholder image in the left media block',
      },
      {
        type: 'add-title',
        id: 'title',
        text: 'AI Design Revolution',
        placementHint: 'right text block, centered',
      },
    ];

    const element = await service.generateSlideElementFromTask(allTasks[0]!, {
      userPrompt: 'Create a LocalStudio.ai hero slide',
      allTasks,
      page: {
        name: 'Generated slide',
        width: 1920,
        height: 1080,
        background: { type: 'color', color: '#050D10' },
      },
      existingElements: [],
    });

    expect(element).toMatchObject({
      type: 'image',
      assetRole: 'placeholder',
      x: 48,
      y: 195,
      width: 980,
      height: 735,
    });
  });
});
