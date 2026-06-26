import { TRANSFORMERS_CACHE_KEY } from './imageGenerationModels';

export interface TextGenerationRuntime {
  preload(modelId: string, options?: { onProgress?: (progress: number) => void }): Promise<void>;
  generate(modelId: string, prompt: string): Promise<string>;
}

type TextGenerationPipeline = (prompt: string, options?: Record<string, unknown>) => Promise<unknown>;

function extractGeneratedText(result: unknown) {
  if (typeof result === 'string') return result;
  if (Array.isArray(result)) {
    const first = result[0] as { generated_text?: unknown } | undefined;
    if (typeof first?.generated_text === 'string') return first.generated_text;
  }
  if (result && typeof result === 'object' && 'generated_text' in result) {
    const generatedText = (result as { generated_text?: unknown }).generated_text;
    if (typeof generatedText === 'string') return generatedText;
  }
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

  async generate(modelId: string, prompt: string): Promise<string> {
    const textGeneration = await this.loadPipeline(modelId);
    const result = await textGeneration(prompt, {
      do_sample: false,
      max_new_tokens: 2048,
      return_full_text: false,
    });
    return extractGeneratedText(result);
  }

  private loadPipeline(modelId: string, options?: { onProgress?: (progress: number) => void }) {
    const existingPipeline = this.pipelines.get(modelId);
    if (existingPipeline) return existingPipeline;

    const pipelinePromise = import('@huggingface/transformers').then(async ({ env, pipeline }) => {
      env.useBrowserCache = true;
      env.cacheKey = TRANSFORMERS_CACHE_KEY;
      return await pipeline('text-generation', modelId, {
        dtype: 'q4',
        device: 'webgpu',
        progress_callback: (progress) => {
          const progressValue = 'progress' in progress ? progress.progress : undefined;
          if (typeof progressValue === 'number') {
            options?.onProgress?.(progressValue);
          }
        },
      });
    });
    this.pipelines.set(modelId, pipelinePromise);
    return pipelinePromise;
  }
}
