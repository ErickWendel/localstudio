import { imageGenerationModel } from '../image-generation/imageGenerationModel';
import type { ModelDownloadProgressDetails } from '../contracts/interfaces';
import { progress } from '../model-setup/progress';
import type {
  TranscriptEmbeddingWorkerRequest,
  TranscriptEmbeddingWorkerResponse,
} from './transcriptEmbeddingRuntimeClient';
import type { TranscriptEmbeddingPreset } from './transcriptionModelCatalog';

type FeatureExtractionPipeline = ((
  input: string[],
  options?: { normalize?: boolean; pooling?: 'mean' },
) => Promise<{ tolist?: () => number[][] }>) & {
  dispose?: () => Promise<void> | void;
};

const pipelines = new Map<string, Promise<FeatureExtractionPipeline>>();

function postResponse(response: TranscriptEmbeddingWorkerResponse) {
  self.postMessage(response);
}

function isEmbeddingMatrix(value: unknown): value is number[][] {
  return (
    Array.isArray(value) &&
    value.every(
      (row) => Array.isArray(row) && row.every((item) => typeof item === 'number'),
    )
  );
}

function loadPipeline(
  preset: TranscriptEmbeddingPreset,
  options?: {
    onProgress?: (progress: number, details?: ModelDownloadProgressDetails) => void;
  },
) {
  const existingPipeline = pipelines.get(preset.modelId);
  if (existingPipeline) return existingPipeline;
  const pipelinePromise = import('@huggingface/transformers').then(async ({ env, pipeline }) => {
    env.useBrowserCache = true;
    env.cacheKey = imageGenerationModel.TRANSFORMERS_CACHE_KEY;
    return await pipeline('feature-extraction', preset.modelId, {
      device: 'webgpu',
      progress_callback: progress.createTransformersProgressCallback(options?.onProgress),
    });
  });
  pipelines.set(preset.modelId, pipelinePromise);
  return pipelinePromise;
}

self.onmessage = (event: MessageEvent<TranscriptEmbeddingWorkerRequest>) => {
  void handleRequest(event.data);
};

async function handleRequest(request: TranscriptEmbeddingWorkerRequest) {
  try {
    if (request.type === 'preload') {
      await loadPipeline(request.preset, {
        onProgress: (progressValue, details) =>
          postResponse({
            ...(details ? { details } : {}),
            id: request.id,
            progress: progressValue,
            type: 'progress',
          }),
      });
      postResponse({ id: request.id, type: 'result' });
      return;
    }

    const extractor = await loadPipeline(request.preset);
    const output = await extractor(request.texts, { pooling: 'mean', normalize: true });
    const embeddings = output.tolist?.();
    postResponse({
      embeddings: isEmbeddingMatrix(embeddings) ? embeddings : [],
      id: request.id,
      type: 'result',
    });
  } catch (error) {
    postResponse({
      id: request.id,
      message: error instanceof Error ? error.message : 'Transcript embedding failed.',
      type: 'error',
    });
  }
}
