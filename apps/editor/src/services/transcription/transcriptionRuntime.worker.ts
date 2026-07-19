import { imageGenerationModel } from '../image-generation/imageGenerationModel';
import type { ModelDownloadProgressDetails } from '../contracts/interfaces';
import { progress } from '../model-setup/progress';
import type {
  TranscriptionWorkerRequest,
  TranscriptionWorkerResponse,
} from './transcriptionRuntimeClient';
import type { TranscriptionModelPreset } from './transcriptionModelCatalog';

interface WhisperTokenizer {
  batch_decode(value: unknown, options?: { skip_special_tokens?: boolean }): unknown;
}

type WhisperProcessor = (input: Float32Array) => Promise<Record<string, unknown>>;

interface WhisperGenerationModel {
  dispose?: () => Promise<void> | void;
  generate(input: Record<string, unknown>): Promise<unknown>;
}

interface WhisperRuntime {
  model: WhisperGenerationModel;
  processor: WhisperProcessor;
  streamerConstructor: TextStreamerConstructor;
  tokenizer: WhisperTokenizer;
  warmedUp: boolean;
}

interface TextStreamerConstructor {
  new (
    tokenizer: WhisperTokenizer,
    options: {
      callback_function: (text: string) => void;
      skip_prompt: boolean;
      skip_special_tokens: boolean;
    },
  ): unknown;
}

interface TransformersWhisperModule {
  AutoProcessor: {
    from_pretrained(
      modelId: string,
      options?: { progress_callback?: (progress: unknown) => void },
    ): Promise<WhisperProcessor>;
  };
  AutoTokenizer: {
    from_pretrained(
      modelId: string,
      options?: { progress_callback?: (progress: unknown) => void },
    ): Promise<WhisperTokenizer>;
  };
  TextStreamer: TextStreamerConstructor;
  WhisperForConditionalGeneration: {
    from_pretrained(
      modelId: string,
      options?: {
        device?: 'webgpu';
        dtype?: { decoder_model_merged: 'fp16' | 'fp32' | 'q4' | 'q8'; encoder_model: 'fp32' };
        progress_callback?: (progress: unknown) => void;
      },
    ): Promise<WhisperGenerationModel>;
  };
  env: {
    cacheKey?: string;
    useBrowserCache?: boolean;
  };
  full(size: number[], fillValue: number): unknown;
}

const maxNewTokens = 64;
const runtimes = new Map<string, Promise<WhisperRuntime>>();

function postResponse(response: TranscriptionWorkerResponse) {
  self.postMessage(response);
}

function extractTranscriptText(value: unknown) {
  if (Array.isArray(value)) {
    return value.find((item) => typeof item === 'string')?.trim() ?? '';
  }
  if (!value || typeof value !== 'object') return '';
  const text = (value as { text?: unknown }).text;
  return typeof text === 'string' ? text.trim() : '';
}

function createProgressCallback(options?: {
  onProgress?: (progress: number, details?: ModelDownloadProgressDetails) => void;
}) {
  return progress.createTransformersProgressCallback(options?.onProgress);
}

async function importWhisperModule() {
  const transformers = await import('@huggingface/transformers');
  return transformers as unknown as TransformersWhisperModule;
}

function loadRuntime(
  preset: TranscriptionModelPreset,
  options?: {
    onProgress?: (progress: number, details?: ModelDownloadProgressDetails) => void;
  },
) {
  const existingRuntime = runtimes.get(preset.modelId);
  if (existingRuntime) return existingRuntime;

  const runtimePromise = importWhisperModule().then(async (transformers) => {
    transformers.env.useBrowserCache = true;
    transformers.env.cacheKey = imageGenerationModel.TRANSFORMERS_CACHE_KEY;
    const progressCallback = createProgressCallback(options);
    const [tokenizer, processor, model] = await Promise.all([
      transformers.AutoTokenizer.from_pretrained(preset.modelId, {
        progress_callback: progressCallback,
      }),
      transformers.AutoProcessor.from_pretrained(preset.modelId, {
        progress_callback: progressCallback,
      }),
      transformers.WhisperForConditionalGeneration.from_pretrained(preset.modelId, {
        device: 'webgpu',
        dtype: {
          decoder_model_merged: preset.dtype ?? 'q4',
          encoder_model: 'fp32',
        },
        progress_callback: progressCallback,
      }),
    ]);
    return {
      model,
      processor,
      streamerConstructor: transformers.TextStreamer,
      tokenizer,
      warmedUp: false,
    };
  });
  runtimes.set(preset.modelId, runtimePromise);
  return runtimePromise;
}

async function warmUpRuntime(runtime: WhisperRuntime) {
  if (runtime.warmedUp) return;
  const transformers = await importWhisperModule();
  await runtime.model.generate({
    input_features: transformers.full([1, 80, 3000], 0),
    max_new_tokens: 1,
  });
  runtime.warmedUp = true;
}

self.onmessage = (event: MessageEvent<TranscriptionWorkerRequest>) => {
  void handleRequest(event.data);
};

async function handleRequest(request: TranscriptionWorkerRequest) {
  try {
    if (request.type === 'preload') {
      const runtime = await loadRuntime(request.preset, {
        onProgress: (progressValue, details) =>
          postResponse({
            ...(details ? { details } : {}),
            id: request.id,
            progress: progressValue,
            type: 'progress',
          }),
      });
      await warmUpRuntime(runtime);
      postResponse({ id: request.id, type: 'result' });
      return;
    }

    if (request.type === 'dispose') {
      const runtimePromise = runtimes.get(request.preset.modelId);
      runtimes.delete(request.preset.modelId);
      const runtime = await runtimePromise?.catch(() => undefined);
      await runtime?.model.dispose?.();
      postResponse({ id: request.id, type: 'result' });
      return;
    }

    const runtime = await loadRuntime(request.preset);
    await warmUpRuntime(runtime);
    const audioData = new Float32Array(request.audio);
    if (audioData.length === 0) throw new Error('No microphone audio data was captured.');
    const inputFeatures = await runtime.processor(audioData);
    const partialText: string[] = [];
    const streamer = new runtime.streamerConstructor(runtime.tokenizer, {
      callback_function: (text) => {
        partialText.push(text);
        postResponse({
          id: request.id,
          text: partialText.join('').trim(),
          type: 'partial',
        });
      },
      skip_prompt: true,
      skip_special_tokens: true,
    });
    const output = await runtime.model.generate({
      ...inputFeatures,
      ...(request.language ? { language: request.language } : {}),
      max_new_tokens: maxNewTokens,
      streamer,
    });
    postResponse({
      id: request.id,
      text: extractTranscriptText(
        runtime.tokenizer.batch_decode(output, { skip_special_tokens: true }),
      ),
      type: 'result',
    });
  } catch (error) {
    postResponse({
      id: request.id,
      message: error instanceof Error ? error.message : 'Transcription failed.',
      type: 'error',
    });
  }
}
