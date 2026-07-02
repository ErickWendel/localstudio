import type { ModelDownloadProgressDetails } from '../contracts/interfaces';
import type {
  BackgroundSegmentationResult,
  LanguageDetectionResult,
  SegmentationPoint,
  TextGenerationInput,
  TextGenerationOptions,
} from './transformersOperations';

export type TransformersWorkerRequest =
  | {
      id: string;
      modelId: string;
      type: 'preload-text-generation';
    }
  | {
      id: string;
      modelId: string;
      options?: TextGenerationOptions;
      prompt: TextGenerationInput;
      type: 'generate-text';
    }
  | {
      id: string;
      modelId: string;
      type: 'release-text-generation' | 'remove-text-generation';
    }
  | {
      id: string;
      modelId: string;
      type: 'preload-language-detection';
    }
  | {
      id: string;
      modelId: string;
      text: string;
      type: 'detect-language';
    }
  | {
      id: string;
      type: 'preload-image-editing';
    }
  | {
      id: string;
      type: 'remove-image-editing';
    }
  | {
      id: string;
      objectUrl: string;
      type: 'prepare-background-removal';
    }
  | {
      id: string;
      objectUrl: string;
      points: SegmentationPoint[];
      type: 'segment-background-removal';
    };

export type TransformersWorkerResponse =
  | {
      details?: ModelDownloadProgressDetails;
      id: string;
      progress: number;
      type: 'progress';
    }
  | {
      id: string;
      result?: BackgroundSegmentationResult | LanguageDetectionResult | string;
      type: 'result';
    }
  | {
      id: string;
      message: string;
      type: 'error';
    };

interface PendingTransformersRequest {
  onProgress?: ((progress: number, details?: ModelDownloadProgressDetails) => void) | undefined;
  reject: (error: Error) => void;
  resolve: (
    result: BackgroundSegmentationResult | LanguageDetectionResult | string | undefined,
  ) => void;
}

interface TransformersRuntimeClientOptions {
  createWorker?: () => Worker;
  fallbackOperations?: TransformersOperationsFallback;
}

interface TransformersOperationsFallback {
  detectLanguage(modelId: string, text: string): Promise<LanguageDetectionResult>;
  generateText(
    modelId: string,
    prompt: TextGenerationInput,
    options?: TextGenerationOptions,
  ): Promise<string>;
  preloadImageEditing(options?: {
    onProgress?: (progress: number, details?: ModelDownloadProgressDetails) => void;
  }): Promise<void>;
  removeImageEditing(): Promise<void>;
  preloadLanguageDetection(
    modelId: string,
    options?: { onProgress?: (progress: number, details?: ModelDownloadProgressDetails) => void },
  ): Promise<void>;
  preloadTextGeneration(
    modelId: string,
    options?: { onProgress?: (progress: number, details?: ModelDownloadProgressDetails) => void },
  ): Promise<void>;
  prepareBackgroundRemoval(
    objectUrl: string,
    options?: { onProgress?: (progress: number) => void },
  ): Promise<void>;
  releaseTextGeneration(modelId: string): Promise<void>;
  removeTextGeneration(modelId: string): Promise<void>;
  segmentBackgroundRemoval(
    objectUrl: string,
    points: SegmentationPoint[],
  ): Promise<BackgroundSegmentationResult>;
}

export class TransformersRuntimeClient {
  private fallbackOperations: TransformersOperationsFallback | undefined;
  private pendingRequests = new Map<string, PendingTransformersRequest>();
  private worker: Worker | undefined;

  constructor(private readonly options: TransformersRuntimeClientOptions = {}) {}

  preloadTextGeneration(
    modelId: string,
    options?: { onProgress?: (progress: number, details?: ModelDownloadProgressDetails) => void },
  ) {
    return this.request(
      {
        id: createRequestId(),
        modelId,
        type: 'preload-text-generation',
      },
      options,
    ).then(() => undefined);
  }

  async generateText(
    modelId: string,
    prompt: TextGenerationInput,
    options?: TextGenerationOptions,
  ) {
    const result = await this.request({
      id: createRequestId(),
      modelId,
      prompt,
      type: 'generate-text',
      ...(options ? { options } : {}),
    });
    if (typeof result !== 'string')
      throw new Error('Transformers text worker did not return text.');
    return result;
  }

  releaseTextGeneration(modelId: string) {
    return this.request({
      id: createRequestId(),
      modelId,
      type: 'release-text-generation',
    }).then(() => undefined);
  }

  removeTextGeneration(modelId: string) {
    return this.request({
      id: createRequestId(),
      modelId,
      type: 'remove-text-generation',
    }).then(() => undefined);
  }

  preloadLanguageDetection(
    modelId: string,
    options?: { onProgress?: (progress: number, details?: ModelDownloadProgressDetails) => void },
  ) {
    return this.request(
      {
        id: createRequestId(),
        modelId,
        type: 'preload-language-detection',
      },
      options,
    ).then(() => undefined);
  }

  async detectLanguage(modelId: string, text: string) {
    const result = await this.request({
      id: createRequestId(),
      modelId,
      text,
      type: 'detect-language',
    });
    if (!isLanguageDetectionResult(result)) {
      throw new Error('Transformers language detection worker did not return a language.');
    }
    return result;
  }

  preloadImageEditing(options?: {
    onProgress?: (progress: number, details?: ModelDownloadProgressDetails) => void;
  }) {
    return this.request(
      {
        id: createRequestId(),
        type: 'preload-image-editing',
      },
      options,
    ).then(() => undefined);
  }

  removeImageEditing() {
    return this.request({
      id: createRequestId(),
      type: 'remove-image-editing',
    }).then(() => undefined);
  }

  prepareBackgroundRemoval(
    objectUrl: string,
    options?: { onProgress?: (progress: number) => void },
  ) {
    return this.request(
      {
        id: createRequestId(),
        objectUrl,
        type: 'prepare-background-removal',
      },
      options,
    ).then(() => undefined);
  }

  async segmentBackgroundRemoval(objectUrl: string, points: SegmentationPoint[]) {
    const result = await this.request({
      id: createRequestId(),
      objectUrl,
      points,
      type: 'segment-background-removal',
    });
    if (!isBackgroundSegmentationResult(result)) {
      throw new Error('Transformers background removal worker did not return a mask.');
    }
    return result;
  }

  private request(
    request: TransformersWorkerRequest,
    options?: { onProgress?: (progress: number, details?: ModelDownloadProgressDetails) => void },
  ) {
    const worker = this.getWorker();
    if (!worker) return this.executeFallbackRequest(request, options);

    return new Promise<BackgroundSegmentationResult | LanguageDetectionResult | string | undefined>(
      (resolve, reject) => {
        this.pendingRequests.set(request.id, {
          onProgress: options?.onProgress,
          reject,
          resolve,
        });
        worker.postMessage(request);
      },
    );
  }

  private getWorker() {
    if (this.worker) return this.worker;
    try {
      const worker = this.options.createWorker?.() ?? createDefaultTransformersWorker();
      worker.onmessage = (event: MessageEvent<TransformersWorkerResponse>) => {
        this.handleWorkerResponse(event.data);
      };
      worker.onerror = (event) => {
        const message = event instanceof ErrorEvent ? event.message : 'Transformers worker failed.';
        this.rejectAllPending(message);
      };
      this.worker = worker;
      return worker;
    } catch {
      this.fallbackOperations = this.getFallbackOperations();
      return undefined;
    }
  }

  private getFallbackOperations() {
    if (!this.options.fallbackOperations) {
      throw new Error('Web workers are required for local Transformers workflows.');
    }
    this.fallbackOperations ??= this.options.fallbackOperations;
    return this.fallbackOperations;
  }

  private handleWorkerResponse(response: TransformersWorkerResponse) {
    const pending = this.pendingRequests.get(response.id);
    if (!pending) return;
    if (response.type === 'progress') {
      pending.onProgress?.(response.progress, response.details);
      return;
    }
    this.pendingRequests.delete(response.id);
    if (response.type === 'error') {
      pending.reject(new Error(response.message));
      return;
    }
    pending.resolve(response.result);
  }

  private rejectAllPending(message: string) {
    for (const [id, pending] of this.pendingRequests) {
      this.pendingRequests.delete(id);
      pending.reject(new Error(message));
    }
  }

  private executeFallbackRequest(
    request: TransformersWorkerRequest,
    options?: { onProgress?: (progress: number, details?: ModelDownloadProgressDetails) => void },
  ) {
    const operations = this.getFallbackOperations();
    switch (request.type) {
      case 'preload-text-generation':
        return operations.preloadTextGeneration(request.modelId, options).then(() => undefined);
      case 'generate-text':
        return operations.generateText(request.modelId, request.prompt, request.options);
      case 'release-text-generation':
        return operations.releaseTextGeneration(request.modelId).then(() => undefined);
      case 'remove-text-generation':
        return operations.removeTextGeneration(request.modelId).then(() => undefined);
      case 'preload-language-detection':
        return operations.preloadLanguageDetection(request.modelId, options).then(() => undefined);
      case 'detect-language':
        return operations.detectLanguage(request.modelId, request.text);
      case 'preload-image-editing':
        return operations.preloadImageEditing(options).then(() => undefined);
      case 'remove-image-editing':
        return operations.removeImageEditing().then(() => undefined);
      case 'prepare-background-removal':
        return operations
          .prepareBackgroundRemoval(request.objectUrl, options)
          .then(() => undefined);
      case 'segment-background-removal':
        return operations.segmentBackgroundRemoval(request.objectUrl, request.points);
    }
  }
}

function createRequestId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `transformers-request-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function createDefaultTransformersWorker() {
  if (typeof Worker === 'undefined') throw new Error('Web workers are not available.');
  return new Worker(new URL('./transformersRuntime.worker.ts', import.meta.url), {
    type: 'module',
  });
}

function isLanguageDetectionResult(value: unknown): value is LanguageDetectionResult {
  return Boolean(
    value &&
    typeof value === 'object' &&
    'language' in value &&
    typeof (value as { language?: unknown }).language === 'string',
  );
}

function isBackgroundSegmentationResult(value: unknown): value is BackgroundSegmentationResult {
  return Boolean(
    value && typeof value === 'object' && 'imageInput' in value && 'subjectMask' in value,
  );
}
