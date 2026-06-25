import type { Asset } from '../domain/model';
import type { ImageGenerationOptions, ImageGenerationService } from './interfaces';
import {
  DEFAULT_IMAGE_GENERATION_SIZE,
  DEFAULT_IMAGE_GENERATION_STEPS,
  IMAGE_GENERATION_TRANSFORMERS_MODEL_ID,
  TRANSFORMERS_CACHE_KEY,
} from './imageGenerationModels';

interface BonsaiImageRuntimeGenerateOptions {
  height: number;
  modelId: string;
  prompt: string;
  seed?: number;
  steps: number;
  width: number;
  onStep?: (step: number, totalSteps: number) => void;
}

export interface BonsaiImageRuntime {
  preload(modelId: string, options?: { onProgress?: (progress: number) => void }): Promise<void>;
  generate(options: BonsaiImageRuntimeGenerateOptions): Promise<Blob>;
}

interface BonsaiPipelineResult {
  toBlob?: () => Blob | Promise<Blob>;
}

interface BonsaiPipeline {
  generate(options: {
    callback_on_step_end?: (_pipeline: unknown, step: number) => void;
    guidance_scale: 1;
    height: number;
    num_inference_steps: number;
    prompt: string;
    seed?: number;
    width: number;
  }): Promise<BonsaiPipelineResult | Blob>;
}

interface BrowserImageGenerationServiceOptions {
  createId?: (prefix: string) => string;
  createObjectUrl?: (blob: Blob) => string;
  runtime?: BonsaiImageRuntime;
}

interface BonsaiModelManifest {
  total_bytes?: number | undefined;
  files: Array<{ remote_path: string; size: number }>;
}

const BONSAI_MODEL_CACHE_NAME = 'localstudio-ai-bonsai-image-models-v1';

function defaultCreateId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now().toString(36)}`;
}

function sanitizeImageName(prompt: string) {
  const safeName = prompt.trim().replace(/\s+/g, ' ').slice(0, 48);
  return `${safeName || 'Generated image'}.png`;
}

async function resultToBlob(result: BonsaiPipelineResult | Blob) {
  if (result instanceof Blob) return result;
  if (typeof result.toBlob === 'function') {
    return await result.toBlob();
  }
  throw new Error('Bonsai Image WebGPU did not return a PNG blob.');
}

export class BrowserBonsaiImageRuntime implements BonsaiImageRuntime {
  private pipelinePromise: Promise<BonsaiPipeline> | undefined;

  async preload(modelId: string, options?: { onProgress?: (progress: number) => void }): Promise<void> {
    await preloadBonsaiModelFiles(modelId, options);
  }

  async generate(options: BonsaiImageRuntimeGenerateOptions): Promise<Blob> {
    const pipeline = await this.loadPipeline(options.modelId);
    const result = await pipeline.generate({
      prompt: options.prompt,
      height: options.height,
      width: options.width,
      guidance_scale: 1,
      num_inference_steps: options.steps,
      ...(options.seed !== undefined ? { seed: options.seed } : {}),
      callback_on_step_end: (_pipeline, step) => {
        options.onStep?.(step + 1, options.steps);
      },
    });
    return resultToBlob(result);
  }

  private async loadPipeline(modelId: string): Promise<BonsaiPipeline> {
    this.pipelinePromise ??= import('@huggingface/transformers').then(async (module) => {
      module.env.useBrowserCache = true;
      module.env.cacheKey = TRANSFORMERS_CACHE_KEY;

      const pipelineFactory = (module as unknown as {
        pipeline?: (
          task: string,
          model: string,
          options: { device: 'webgpu' },
        ) => Promise<BonsaiPipeline>;
      }).pipeline;
      if (typeof pipelineFactory !== 'function') {
        throw new Error('Bonsai Image WebGPU runtime is unavailable in this browser build.');
      }
      return pipelineFactory('text-to-image', modelId, { device: 'webgpu' });
    });
    return this.pipelinePromise;
  }
}

function modelFileUrl(modelId: string, remotePath: string) {
  return `https://huggingface.co/${modelId}/resolve/main/${remotePath
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/')}`;
}

async function fetchModelManifest(modelId: string): Promise<BonsaiModelManifest> {
  const response = await fetch(modelFileUrl(modelId, 'manifest.json'));
  if (!response.ok) {
    throw new Error(`Bonsai model manifest download failed: ${response.status} ${response.statusText}`);
  }
  const manifest = (await response.json()) as Partial<BonsaiModelManifest>;
  if (!Array.isArray(manifest.files)) {
    throw new Error('Bonsai model manifest is missing its file list.');
  }
  return {
    total_bytes: manifest.total_bytes,
    files: manifest.files.filter(
      (file): file is { remote_path: string; size: number } =>
        typeof file.remote_path === 'string' && Number.isFinite(file.size),
    ),
  };
}

async function preloadBonsaiModelFiles(modelId: string, options?: { onProgress?: (progress: number) => void }) {
  if (typeof fetch !== 'function') {
    throw new Error('Browser fetch is required to download Bonsai image models.');
  }
  if (typeof caches === 'undefined') {
    throw new Error('Browser Cache API is required to store Bonsai image models.');
  }

  const manifest = await fetchModelManifest(modelId);
  const cache = await caches.open(BONSAI_MODEL_CACHE_NAME);
  const totalBytes =
    manifest.total_bytes ?? manifest.files.reduce((total, file) => total + Math.max(0, file.size), 0);
  const progressTotalBytes = Math.max(1, totalBytes);
  let loadedBytes = 0;
  let lastProgress = -1;
  const reportProgress = (progress: number) => {
    const boundedProgress = Math.max(0, Math.min(100, progress));
    if (boundedProgress <= lastProgress) return;
    lastProgress = boundedProgress;
    options?.onProgress?.(boundedProgress);
  };

  for (const file of manifest.files) {
    const url = modelFileUrl(modelId, file.remote_path);
    const cachedResponse = await cache.match(url);
    if (cachedResponse) {
      loadedBytes += file.size;
      reportProgress((loadedBytes / progressTotalBytes) * 100);
      continue;
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Bonsai model file download failed for ${file.remote_path}: ${response.status} ${response.statusText}`);
    }
    await cacheResponseWithProgress({
      cache,
      expectedFileSize: file.size,
      onProgress: (downloadedFileBytes) => {
        reportProgress(((loadedBytes + downloadedFileBytes) / progressTotalBytes) * 100);
      },
      response,
      url,
    });
    loadedBytes += file.size;
    reportProgress((loadedBytes / progressTotalBytes) * 100);
  }

  reportProgress(100);
}

async function cacheResponseWithProgress({
  cache,
  expectedFileSize,
  onProgress,
  response,
  url,
}: {
  cache: Cache;
  expectedFileSize: number;
  onProgress: (downloadedFileBytes: number) => void;
  response: Response;
  url: string;
}) {
  if (!response.body || typeof TransformStream === 'undefined') {
    await cache.put(url, response.clone());
    onProgress(expectedFileSize);
    return;
  }

  let downloadedBytes = 0;
  const countingStream = response.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        downloadedBytes += chunk.byteLength;
        onProgress(Math.min(expectedFileSize, downloadedBytes));
        controller.enqueue(chunk);
      },
    }),
  );
  const countedResponse = new Response(countingStream, {
    headers: response.headers,
    status: response.status,
    statusText: response.statusText,
  });

  await cache.put(url, countedResponse);
  onProgress(expectedFileSize);
}

export class BrowserImageGenerationService implements ImageGenerationService {
  private readonly runtime: BonsaiImageRuntime;

  constructor(private readonly options: BrowserImageGenerationServiceOptions = {}) {
    this.runtime = options.runtime ?? new BrowserBonsaiImageRuntime();
  }

  async generateImage(prompt: string, options: ImageGenerationOptions = {}): Promise<Asset> {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) throw new Error('Enter a prompt before generating an image.');

    const steps = options.steps ?? DEFAULT_IMAGE_GENERATION_STEPS;
    const blob = await this.runtime.generate({
      modelId: IMAGE_GENERATION_TRANSFORMERS_MODEL_ID,
      prompt: trimmedPrompt,
      height: options.height ?? DEFAULT_IMAGE_GENERATION_SIZE,
      width: options.width ?? DEFAULT_IMAGE_GENERATION_SIZE,
      steps,
      ...(options.seed !== undefined ? { seed: options.seed } : {}),
      onStep: (step, totalSteps) => {
        options.onProgress?.({
          label: `Generating image ${step}/${totalSteps}`,
          progress: Math.round((step / totalSteps) * 100),
        });
      },
    });

    return {
      id: this.options.createId?.('asset-generated-image') ?? defaultCreateId('asset-generated-image'),
      type: 'image',
      name: sanitizeImageName(trimmedPrompt),
      mimeType: blob.type || 'image/png',
      objectUrl: this.options.createObjectUrl?.(blob) ?? URL.createObjectURL(blob),
    };
  }
}
