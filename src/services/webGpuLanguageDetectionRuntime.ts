import { TRANSFORMERS_CACHE_KEY } from './imageGenerationModels';
import { createTransformersProgressCallback } from './progress';

export interface LanguageDetectionRuntime {
  preload(modelId: string, options?: { onProgress?: (progress: number) => void }): Promise<void>;
  detectLanguage(modelId: string, text: string): Promise<{ language: string; score?: number | undefined }>;
}

type TextClassificationResult = { label?: unknown; score?: unknown };
type TextClassificationPipeline = ((text: string, options?: Record<string, unknown>) => Promise<unknown>) & {
  dispose?: () => Promise<void> | void;
};

function isTextClassificationResult(value: unknown): value is TextClassificationResult {
  return Boolean(value && typeof value === 'object');
}

function getTopClassificationResult(result: unknown): TextClassificationResult | undefined {
  if (Array.isArray(result)) {
    const values: unknown[] = result;
    const first = values[0];
    if (Array.isArray(first)) return getTopClassificationResult(first);
    return isTextClassificationResult(first) ? first : undefined;
  }
  return isTextClassificationResult(result) ? result : undefined;
}

export function extractDetectedLanguage(result: unknown) {
  const topResult = getTopClassificationResult(result);
  const label = topResult?.label;
  if (typeof label !== 'string' || !label.trim()) {
    throw new Error('Language detection model did not return a language label.');
  }

  return {
    language: label,
    ...(typeof topResult?.score === 'number' ? { score: topResult.score } : {}),
  };
}

export class TransformersLanguageDetectionRuntime implements LanguageDetectionRuntime {
  private pipelines = new Map<string, Promise<TextClassificationPipeline>>();

  loadLanguageDetectionModel(modelId: string, options?: { onProgress?: (progress: number) => void }): Promise<void> {
    return this.preload(modelId, options);
  }

  async preload(modelId: string, options?: { onProgress?: (progress: number) => void }): Promise<void> {
    await this.loadPipeline(modelId, options);
  }

  async detectLanguage(modelId: string, text: string) {
    const detector = await this.loadPipeline(modelId);
    const result = await detector(text, {
      topk: 1,
      truncation: true,
    });
    return extractDetectedLanguage(result);
  }

  private loadPipeline(modelId: string, options?: { onProgress?: (progress: number) => void }) {
    const existingPipeline = this.pipelines.get(modelId);
    if (existingPipeline) return existingPipeline;

    const pipelinePromise = import('@huggingface/transformers').then(async ({ env, pipeline }) => {
      env.useBrowserCache = true;
      env.cacheKey = TRANSFORMERS_CACHE_KEY;
      return (await pipeline('text-classification', modelId, {
        device: 'webgpu',
        progress_callback: createTransformersProgressCallback(options?.onProgress),
      }));
    });
    this.pipelines.set(modelId, pipelinePromise);
    return pipelinePromise;
  }
}
