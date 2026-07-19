import { imageGenerationModel } from '../image-generation/imageGenerationModel';
import type { ModelDownloadProgressDetails } from '../contracts/interfaces';
import { progress } from '../model-setup/progress';
import type {
  TranscriptionWorkerRequest,
  TranscriptionWorkerResponse,
} from './transcriptionRuntimeClient';
import type { TranscriptionModelPreset } from './transcriptionModelCatalog';

type AutomaticSpeechRecognitionPipeline = ((input: Float32Array) => Promise<unknown>) & {
  dispose?: () => Promise<void> | void;
};

const pipelines = new Map<string, Promise<AutomaticSpeechRecognitionPipeline>>();

function postResponse(response: TranscriptionWorkerResponse) {
  self.postMessage(response);
}

function extractTranscriptText(value: unknown) {
  if (!value || typeof value !== 'object') return '';
  const text = (value as { text?: unknown }).text;
  return typeof text === 'string' ? text.trim() : '';
}

function loadPipeline(
  preset: TranscriptionModelPreset,
  options?: {
    onProgress?: (progress: number, details?: ModelDownloadProgressDetails) => void;
  },
) {
  const existingPipeline = pipelines.get(preset.modelId);
  if (existingPipeline) return existingPipeline;

  const pipelinePromise = import('@huggingface/transformers').then(async ({ env, pipeline }) => {
    env.useBrowserCache = true;
    env.cacheKey = imageGenerationModel.TRANSFORMERS_CACHE_KEY;
    return await pipeline('automatic-speech-recognition', preset.modelId, {
      device: 'webgpu',
      ...(preset.dtype ? { dtype: preset.dtype } : {}),
      progress_callback: progress.createTransformersProgressCallback(options?.onProgress),
    });
  });
  pipelines.set(preset.modelId, pipelinePromise);
  return pipelinePromise;
}

self.onmessage = (event: MessageEvent<TranscriptionWorkerRequest>) => {
  void handleRequest(event.data);
};

async function handleRequest(request: TranscriptionWorkerRequest) {
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

    if (request.type === 'dispose') {
      const pipelinePromise = pipelines.get(request.preset.modelId);
      pipelines.delete(request.preset.modelId);
      const pipeline = await pipelinePromise?.catch(() => undefined);
      await pipeline?.dispose?.();
      postResponse({ id: request.id, type: 'result' });
      return;
    }

    const pipeline = await loadPipeline(request.preset);
    const audioData = new Float32Array(request.audio);
    if (audioData.length === 0) throw new Error('No microphone audio data was captured.');
    const result = await pipeline(audioData);
    postResponse({ id: request.id, text: extractTranscriptText(result), type: 'result' });
  } catch (error) {
    postResponse({
      id: request.id,
      message: error instanceof Error ? error.message : 'Transcription failed.',
      type: 'error',
    });
  }
}
