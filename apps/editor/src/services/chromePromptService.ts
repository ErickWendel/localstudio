import { generatedSlide } from '../domain/generated-slides/generatedSlide';
import type { GeneratedSlideElement, GeneratedSlideTask, GeneratedSlideTasksDocument } from '../domain/generated-slides/generatedSlide';
import type { PromptApiAvailability, PromptService } from './interfaces';
import { buildSlideElementPrompt } from './prompts/slideElementPrompt';
import { slideLayoutPresets } from './prompting/slideLayoutPresets';
import { slideTaskPrompt } from './prompting/slideTaskPrompt';

type ChromePromptAvailability =
  | 'available'
  | 'readily'
  | 'downloadable'
  | 'downloading'
  | 'unavailable';

interface ChromePromptSession {
  destroy?: () => void;
  prompt?: (input: string, options?: { responseConstraint?: unknown }) => Promise<string>;
}

interface ChromeLanguageModelApi {
  availability?: () => Promise<ChromePromptAvailability>;
  create?: (options?: { monitor?: (monitorTarget: EventTarget) => void }) => Promise<ChromePromptSession>;
}

function getLanguageModelApi() {
  if (typeof window === 'undefined') return undefined;
  const globalWindow = window as Window & {
    LanguageModel?: ChromeLanguageModelApi;
    ai?: { languageModel?: ChromeLanguageModelApi };
  };
  return globalWindow.LanguageModel ?? globalWindow.ai?.languageModel;
}

function normalizePromptAvailability(availability: ChromePromptAvailability | undefined): PromptApiAvailability {
  if (availability === 'available' || availability === 'readily') return 'ready';
  if (availability === 'downloadable') return 'downloadable';
  if (availability === 'downloading') return 'downloading';
  return 'unavailable';
}

export class ChromePromptService implements PromptService {
  private ready = false;

  async checkAvailability(): Promise<PromptApiAvailability> {
    if (this.ready) return 'ready';
    const languageModel = getLanguageModelApi();
    const availability = await languageModel?.availability?.();
    return normalizePromptAvailability(availability);
  }

  async preparePromptApi(options?: { onProgress?: (progress: number) => void }): Promise<void> {
    const languageModel = getLanguageModelApi();
    if (!languageModel?.create) throw new Error('Chrome Prompt API is unavailable.');

    options?.onProgress?.(5);
    const session = await languageModel.create({
      monitor: (monitorTarget) => {
        monitorTarget.addEventListener('downloadprogress', (event) => {
          const progressEvent = event as CustomEvent<{ loaded?: number; total?: number }>;
          const loaded = progressEvent.detail?.loaded ?? 0;
          const total = progressEvent.detail?.total ?? 1;
          options?.onProgress?.(Math.max(5, Math.min(100, Math.round((loaded / total) * 100))));
        });
      },
    });
    session.destroy?.();
    this.ready = true;
    options?.onProgress?.(100);
  }

  async generateSlideTasksFromPrompt(
    prompt: string,
    options: { targetLanguageHint?: string } = {},
  ): Promise<GeneratedSlideTasksDocument> {
    const response = await this.promptWithStructuredOutput(
      slideTaskPrompt.buildSlideTaskPrompt({
        userPrompt: prompt,
        targetLanguageHint: options.targetLanguageHint ?? 'same as user prompt',
        imageUrls: slideTaskPrompt.extractImageUrls(prompt),
      }),
      generatedSlide.GENERATED_SLIDE_TASKS_RESPONSE_SCHEMA,
    );
    this.ready = true;
    return slideLayoutPresets.normalizeSlideTasksForLayout(generatedSlide.parseGeneratedSlideTasksJson(response), prompt);
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
    const response = await this.promptWithStructuredOutput(
      buildSlideElementPrompt({
        userPrompt: context.userPrompt,
        task,
        allTasks: context.allTasks,
        page: context.page,
        existingElements: context.existingElements,
      }),
      generatedSlide.GENERATED_SLIDE_ELEMENT_RESPONSE_SCHEMA,
    );
    this.ready = true;
    return slideLayoutPresets.applySlideElementLayoutPreset(generatedSlide.parseGeneratedSlideElementJson(response), {
      task,
      allTasks: context.allTasks,
      page: context.page,
    });
  }

  private async promptWithStructuredOutput(prompt: string, responseConstraint: unknown) {
    const languageModel = getLanguageModelApi();
    if (!languageModel?.create) throw new Error('Chrome Prompt API is unavailable.');

    const session = await languageModel.create();
    try {
      if (!session.prompt) throw new Error('Chrome Prompt API session cannot generate text.');
      return await session.prompt(prompt, { responseConstraint });
    } finally {
      session.destroy?.();
    }
  }
}
