import { TRANSFORMERS_CACHE_KEY } from './imageGenerationModels';
import { createTransformersProgressCallback } from './progress';

export interface TextGenerationRuntime {
  preload(modelId: string, options?: { onProgress?: (progress: number) => void }): Promise<void>;
  generate(modelId: string, prompt: TextGenerationInput, options?: TextGenerationOptions): Promise<string>;
  removeTextGenerationModel?(modelId: string): Promise<void>;
}

export type TextGenerationInput = string | Array<{ role: string; content: unknown }>;
export type TextGenerationOptions = Record<string, unknown>;

type TextGenerationPipeline = ((prompt: unknown, options?: TextGenerationOptions) => Promise<unknown>) & {
  dispose?: () => Promise<void> | void;
};

function extractTextFromGeneratedValue(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    const values = value as unknown[];
    const lastMessage = values.at(-1);
    if (lastMessage && typeof lastMessage === 'object') {
      const content = (lastMessage as { content?: unknown }).content;
      if (typeof content === 'string') return content;
      const generatedText = (lastMessage as { generated_text?: unknown }).generated_text;
      const nestedText = extractTextFromGeneratedValue(generatedText);
      if (nestedText) return nestedText;
    }

    const firstMessage = values[0];
    if (firstMessage && typeof firstMessage === 'object') {
      const generatedText = (firstMessage as { generated_text?: unknown }).generated_text;
      const nestedText = extractTextFromGeneratedValue(generatedText);
      if (nestedText) return nestedText;
    }
  }
  if (value && typeof value === 'object' && 'generated_text' in value) {
    return extractTextFromGeneratedValue((value as { generated_text?: unknown }).generated_text);
  }
  return undefined;
}

export function extractGeneratedText(result: unknown) {
  if (typeof result === 'string') return result;
  const generatedText = extractTextFromGeneratedValue(result);
  if (generatedText) return generatedText;
  throw new Error('WebGPU text generation did not return text.');
}

export class TransformersTextGenerationRuntime implements TextGenerationRuntime {
  private pipelines = new Map<string, Promise<TextGenerationPipeline>>();

  loadTextGenerationModel(modelId: string, options?: { onProgress?: (progress: number) => void }): Promise<void> {
    return this.preload(modelId, options);
  }

  async preload(modelId: string, options?: { onProgress?: (progress: number) => void }): Promise<void> {
    await this.loadPipeline(modelId, options);
  }

  async removeTextGenerationModel(modelId: string): Promise<void> {
    const pipelinePromise = this.pipelines.get(modelId);
    this.pipelines.delete(modelId);
    const pipeline = await pipelinePromise?.catch(() => undefined);
    await pipeline?.dispose?.();
  }

  async generate(modelId: string, prompt: TextGenerationInput, options?: TextGenerationOptions): Promise<string> {
    const textGeneration = await this.loadPipeline(modelId);
    const generationOptions: TextGenerationOptions = {
      do_sample: false,
      max_new_tokens: 2048,
      ...options,
    };
    if (typeof prompt === 'string' && !('return_full_text' in generationOptions)) {
      generationOptions.return_full_text = false;
    }
    const result = await textGeneration(prompt, {
      ...generationOptions,
    });
    return extractGeneratedText(result);
  }

  private loadPipeline(modelId: string, options?: { onProgress?: (progress: number) => void }) {
    const existingPipeline = this.pipelines.get(modelId);
    if (existingPipeline) return existingPipeline;

    const pipelinePromise = import('@huggingface/transformers').then(async ({ env, pipeline }) => {
      env.useBrowserCache = true;
      env.cacheKey = TRANSFORMERS_CACHE_KEY;
      return (await pipeline('text-generation', modelId, {
        dtype: 'q4',
        device: 'webgpu',
        progress_callback: createTransformersProgressCallback(options?.onProgress),
      })) as unknown as TextGenerationPipeline;
    });
    this.pipelines.set(modelId, pipelinePromise);
    return pipelinePromise;
  }
}
