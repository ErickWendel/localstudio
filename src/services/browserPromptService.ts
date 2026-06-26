import {
  GENERATED_SLIDE_ELEMENT_RESPONSE_SCHEMA,
  GENERATED_SLIDE_TASKS_RESPONSE_SCHEMA,
  parseGeneratedSlideElementJson,
  parseGeneratedSlideTasksJson,
  type GeneratedSlideElement,
  type GeneratedSlideTask,
  type GeneratedSlideTasksDocument,
} from '../domain/generatedSlide';
import { GEMMA_LLM_MODEL_ID, GEMMA_LLM_TRANSFORMERS_MODEL_ID } from './aiModelIds';
import { ChromePromptService } from './chromePromptService';
import type { AiProviderState, ModelSetupService, PromptApiAvailability, PromptService } from './interfaces';
import {
  getBrowserProviderStorage,
  getModelReadiness,
  isWebGpuCompatible,
  selectDefaultProvider,
} from './providerSelection';
import { createMonotonicProgressReporter, mapProgressToRange } from './progress';
import { buildSlideElementPrompt } from './prompts/slideElementPrompt';
import { applySlideElementLayoutPreset } from './prompts/slideLayoutPresets';
import { buildSlideTaskPrompt, extractImageUrls } from './prompts/slideTaskPrompt';
import {
  TransformersTextGenerationRuntime,
  type TextGenerationInput,
  type TextGenerationRuntime,
} from './webGpuTextGenerationRuntime';

export const CHROME_PROMPT_PROVIDER_ID = 'chrome-prompt-api';
export const GEMMA_PROMPT_PROVIDER_ID = 'gemma-4-webgpu';
export const PROMPT_PROVIDER_STORAGE_KEY = 'localstudio.ai.prompt-provider';

interface PromptProvider {
  id: string;
  label: string;
  description: string;
  runtime: AiProviderState['runtime'];
  modelId?: string | undefined;
  checkAvailability(modelSetupService: ModelSetupService): Promise<PromptApiAvailability>;
  prepare(modelSetupService: ModelSetupService, options?: { onProgress?: (progress: number) => void }): Promise<void>;
  generateSlideTasksFromPrompt(
    prompt: string,
    options?: { targetLanguageHint?: string },
  ): Promise<GeneratedSlideTasksDocument>;
  generateSlideElementFromTask(
    task: Exclude<GeneratedSlideTask, { type: 'set-background' }>,
    context: {
      userPrompt: string;
      allTasks: GeneratedSlideTask[];
      page: GeneratedSlideTasksDocument['page'];
      existingElements: GeneratedSlideElement[];
    },
  ): Promise<GeneratedSlideElement>;
}

class ChromePromptProvider implements PromptProvider {
  id = CHROME_PROMPT_PROVIDER_ID;
  label = 'Chrome Built-in Prompt API';
  description = 'Uses Chrome built-in local language model support.';
  runtime = 'chrome-built-in' as const;

  constructor(private readonly chromePromptService = new ChromePromptService()) {}

  checkAvailability(): Promise<PromptApiAvailability> {
    return this.chromePromptService.checkAvailability();
  }

  prepare(_modelSetupService: ModelSetupService, options?: { onProgress?: (progress: number) => void }): Promise<void> {
    return this.chromePromptService.preparePromptApi(options);
  }

  generateSlideTasksFromPrompt(
    prompt: string,
    options?: { targetLanguageHint?: string },
  ): Promise<GeneratedSlideTasksDocument> {
    return this.chromePromptService.generateSlideTasksFromPrompt(prompt, options);
  }

  generateSlideElementFromTask(
    task: Exclude<GeneratedSlideTask, { type: 'set-background' }>,
    context: {
      userPrompt: string;
      allTasks: GeneratedSlideTask[];
      page: GeneratedSlideTasksDocument['page'];
      existingElements: GeneratedSlideElement[];
    },
  ): Promise<GeneratedSlideElement> {
    return this.chromePromptService.generateSlideElementFromTask(task, context);
  }
}

const GEMMA_JSON_SYSTEM_PROMPT = [
  'You are LocalStudio.ai structured JSON mode.',
  'Return exactly one JSON value matching the requested schema.',
  'Do not use markdown, comments, prose, code fences, or explanations.',
  'The response must start with "{" and end with "}".',
].join('\n');

interface GemmaStructuredJsonOptions<T> {
  prompt: string;
  responseSchema: unknown;
  parse: (value: string) => T;
}

export function createGemmaStructuredJsonMessages(prompt: string, responseSchema: unknown): TextGenerationInput {
  return [
    {
      role: 'user',
      content: [
        GEMMA_JSON_SYSTEM_PROMPT,
        '',
        'JSON Schema:',
        JSON.stringify(responseSchema),
        '',
        'Task:',
        prompt,
      ].join('\n'),
    },
  ];
}

function createGemmaJsonRepairMessages(options: {
  prompt: string;
  responseSchema: unknown;
  invalidResponse: string;
  errorMessage: string;
}): TextGenerationInput {
  return [
    {
      role: 'user',
      content: [
        GEMMA_JSON_SYSTEM_PROMPT,
        '',
        'The previous response was invalid for this schema.',
        `Validation error: ${options.errorMessage}`,
        '',
        'JSON Schema:',
        JSON.stringify(options.responseSchema),
        '',
        'Original task:',
        options.prompt,
        '',
        'Invalid response to repair:',
        options.invalidResponse,
        '',
        'Return only corrected JSON.',
      ].join('\n'),
    },
  ];
}

export class GemmaPromptProvider implements PromptProvider {
  id = GEMMA_PROMPT_PROVIDER_ID;
  label = 'Gemma 4 WebGPU';
  description = 'Browser-local Gemma LLM for prompt-to-slides.';
  runtime = 'webgpu-huggingface' as const;
  modelId = GEMMA_LLM_MODEL_ID;

  constructor(private readonly runtimeClient: TextGenerationRuntime = new TransformersTextGenerationRuntime()) {}

  async checkAvailability(modelSetupService: ModelSetupService): Promise<PromptApiAvailability> {
    if (!isWebGpuCompatible()) return 'unavailable';
    const model = (await modelSetupService.getModelStates()).find((state) => state.id === GEMMA_LLM_MODEL_ID);
    if (model?.status === 'ready') return 'ready';
    if (model?.status === 'downloading') return 'downloading';
    return 'downloadable';
  }

  async prepare(
    modelSetupService: ModelSetupService,
    options?: { onProgress?: (progress: number) => void },
  ): Promise<void> {
    const reportProgress = createMonotonicProgressReporter(options?.onProgress, { initial: 4, min: 4, max: 100 });
    await modelSetupService.downloadModel(GEMMA_LLM_MODEL_ID, {
      onProgress: (progress) => reportProgress(progress),
    });
    await this.runtimeClient.preload(GEMMA_LLM_TRANSFORMERS_MODEL_ID, {
      onProgress: (progress) => reportProgress(mapProgressToRange(progress, 4, 99)),
    });
    reportProgress(100);
  }

  async generateSlideTasksFromPrompt(
    prompt: string,
    options: { targetLanguageHint?: string } = {},
  ): Promise<GeneratedSlideTasksDocument> {
    return this.generateStructuredJson({
      prompt: buildSlideTaskPrompt({
        userPrompt: prompt,
        targetLanguageHint: options.targetLanguageHint ?? 'same as user prompt',
        imageUrls: extractImageUrls(prompt),
      }),
      responseSchema: GENERATED_SLIDE_TASKS_RESPONSE_SCHEMA,
      parse: parseGeneratedSlideTasksJson,
    });
  }

  async generateSlideElementFromTask(
    task: Exclude<GeneratedSlideTask, { type: 'set-background' }>,
    context: {
      userPrompt: string;
      allTasks: GeneratedSlideTask[];
      page: GeneratedSlideTasksDocument['page'];
      existingElements: GeneratedSlideElement[];
    },
  ): Promise<GeneratedSlideElement> {
    const element = await this.generateStructuredJson({
      prompt: buildSlideElementPrompt({
        userPrompt: context.userPrompt,
        task,
        allTasks: context.allTasks,
        page: context.page,
        existingElements: context.existingElements,
      }),
      responseSchema: GENERATED_SLIDE_ELEMENT_RESPONSE_SCHEMA,
      parse: parseGeneratedSlideElementJson,
    });

    return applySlideElementLayoutPreset(element, {
      task,
      allTasks: context.allTasks,
      page: context.page,
    });
  }

  private async generateStructuredJson<T>(options: GemmaStructuredJsonOptions<T>) {
    const response = await this.runtimeClient.generate(
      GEMMA_LLM_TRANSFORMERS_MODEL_ID,
      createGemmaStructuredJsonMessages(options.prompt, options.responseSchema),
      { max_new_tokens: 3072 },
    );

    try {
      return options.parse(response);
    } catch (error) {
      const repairedResponse = await this.runtimeClient.generate(
        GEMMA_LLM_TRANSFORMERS_MODEL_ID,
        createGemmaJsonRepairMessages({
          prompt: options.prompt,
          responseSchema: options.responseSchema,
          invalidResponse: response,
          errorMessage: error instanceof Error ? error.message : String(error),
        }),
        { max_new_tokens: 3072 },
      );
      return options.parse(repairedResponse);
    }
  }
}

export class BrowserPromptService implements PromptService {
  private selectedProviderId: string | undefined;
  private forceSelectedProvider = false;
  private readonly providers: PromptProvider[];

  constructor(
    private readonly modelSetupService: ModelSetupService,
    providers?: PromptProvider[],
    private readonly storage = getBrowserProviderStorage(),
    textGenerationRuntime: TextGenerationRuntime = new TransformersTextGenerationRuntime(),
  ) {
    this.providers = providers ?? [new ChromePromptProvider(), new GemmaPromptProvider(textGenerationRuntime)];
    this.selectedProviderId = storage?.getItem(PROMPT_PROVIDER_STORAGE_KEY) ?? undefined;
  }

  getSelectedProviderId() {
    return this.selectedProviderId ?? CHROME_PROMPT_PROVIDER_ID;
  }

  async setSelectedProvider(providerId: string) {
    const provider = this.providers.find((item) => item.id === providerId);
    if (!provider) throw new Error(`Unknown LLM provider: ${providerId}`);
    this.selectedProviderId = provider.id;
    this.forceSelectedProvider = true;
    this.storage?.setItem(PROMPT_PROVIDER_STORAGE_KEY, provider.id);
    return this.getProviderStates();
  }

  async getProviderStates(): Promise<AiProviderState[]> {
    const modelStates = await this.modelSetupService.getModelStates();
    const states = await Promise.all(
      this.providers.map(async (provider) => {
        const availability = await provider.checkAvailability(this.modelSetupService);
        const chromeUnavailable = provider.runtime === 'chrome-built-in' && availability === 'unavailable';
        const webGpuUnavailable = provider.runtime === 'webgpu-huggingface' && !isWebGpuCompatible();
        const compatibility = chromeUnavailable || webGpuUnavailable ? 'incompatible' : 'compatible';
        return {
          id: provider.id,
          label: provider.label,
          description: provider.description,
          capability: 'prompt' as const,
          runtime: provider.runtime,
          compatibility,
          disabledReason: chromeUnavailable
            ? 'Chrome Built-in Prompt API is unavailable in this browser.'
            : webGpuUnavailable
              ? 'WebGPU is required for Gemma 4.'
              : undefined,
          modelId: provider.modelId,
          readiness:
            provider.runtime === 'chrome-built-in'
              ? availability === 'ready'
                ? 'ready'
                : availability === 'unavailable'
                  ? 'unavailable'
                  : availability === 'downloading'
                  ? 'downloading'
                  : 'needs-download'
              : getModelReadiness(modelStates, provider.modelId),
          selected: false,
        } satisfies AiProviderState;
      }),
    );
    const selected = selectDefaultProvider(states, this.selectedProviderId, {
      forcePreferred: this.forceSelectedProvider,
    });
    this.selectedProviderId = selected?.id;
    return states.map((state) => ({ ...state, selected: state.id === selected?.id }));
  }

  async checkAvailability(): Promise<PromptApiAvailability> {
    return this.getSelectedProvider().checkAvailability(this.modelSetupService);
  }

  async preparePromptApi(options?: { onProgress?: (progress: number) => void }): Promise<void> {
    await this.getSelectedProvider().prepare(this.modelSetupService, options);
  }

  generateSlideTasksFromPrompt(
    prompt: string,
    options?: { targetLanguageHint?: string },
  ): Promise<GeneratedSlideTasksDocument> {
    return this.getSelectedProvider().generateSlideTasksFromPrompt(prompt, options);
  }

  generateSlideElementFromTask(
    task: Exclude<GeneratedSlideTask, { type: 'set-background' }>,
    context: {
      userPrompt: string;
      allTasks: GeneratedSlideTask[];
      page: GeneratedSlideTasksDocument['page'];
      existingElements: GeneratedSlideElement[];
    },
  ): Promise<GeneratedSlideElement> {
    return this.getSelectedProvider().generateSlideElementFromTask(task, context);
  }

  private getSelectedProvider() {
    return (
      this.providers.find((provider) => provider.id === this.selectedProviderId) ??
      this.providers.find((provider) => provider.id === CHROME_PROMPT_PROVIDER_ID) ??
      this.providers[0]!
    );
  }
}
