import type { ModelDownloadProgressDetails } from '../contracts/interfaces';
import type { TranscriptionModelPreset } from './transcriptionModelCatalog';

export type TranscriptionWorkerRequest =
  | {
      id: string;
      preset: TranscriptionModelPreset;
      type: 'preload';
    }
  | {
      audio: ArrayBuffer;
      id: string;
      language?: string | undefined;
      preset: TranscriptionModelPreset;
      type: 'transcribe';
    }
  | {
      id: string;
      preset: TranscriptionModelPreset;
      type: 'dispose';
    };

export type TranscriptionWorkerResponse =
  | {
      details?: ModelDownloadProgressDetails;
      id: string;
      progress: number;
      type: 'progress';
    }
  | {
      id: string;
      text?: string;
      type: 'result';
    }
  | {
      id: string;
      message: string;
      type: 'error';
    };

interface PendingTranscriptionRequest {
  onProgress?: ((progress: number, details?: ModelDownloadProgressDetails) => void) | undefined;
  reject: (error: Error) => void;
  resolve: (text: string | undefined) => void;
}

interface TranscriptionRuntimeClientOptions {
  createWorker?: () => Worker;
}

function createRequestId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `transcription-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function createDefaultWorker() {
  return new Worker(new URL('./transcriptionRuntime.worker.ts', import.meta.url), {
    type: 'module',
  });
}

export class TranscriptionRuntimeClient {
  private pendingRequests = new Map<string, PendingTranscriptionRequest>();
  private worker: Worker | undefined;

  constructor(private readonly options: TranscriptionRuntimeClientOptions = {}) {}

  preload(
    preset: TranscriptionModelPreset,
    options?: { onProgress?: (progress: number, details?: ModelDownloadProgressDetails) => void },
  ) {
    return this.request({ id: createRequestId(), preset, type: 'preload' }, options).then(
      () => undefined,
    );
  }

  async transcribe(
    preset: TranscriptionModelPreset,
    audioData: Float32Array,
    options?: { language?: string | undefined },
  ) {
    const audio = new ArrayBuffer(audioData.byteLength);
    new Float32Array(audio).set(audioData);
    const text = await this.request(
      {
        audio,
        id: createRequestId(),
        ...(options?.language ? { language: options.language } : {}),
        preset,
        type: 'transcribe',
      },
      undefined,
      [audio],
    );
    return text ?? '';
  }

  dispose(preset: TranscriptionModelPreset) {
    return this.request({ id: createRequestId(), preset, type: 'dispose' }).then(() => undefined);
  }

  terminate() {
    this.worker?.terminate();
    this.worker = undefined;
    for (const pendingRequest of this.pendingRequests.values()) {
      pendingRequest.reject(new Error('Transcription worker was terminated.'));
    }
    this.pendingRequests.clear();
  }

  private request(
    request: TranscriptionWorkerRequest,
    options?: { onProgress?: (progress: number, details?: ModelDownloadProgressDetails) => void },
    transfer?: Transferable[],
  ) {
    return new Promise<string | undefined>((resolve, reject) => {
      this.ensureWorker();
      this.pendingRequests.set(request.id, {
        onProgress: options?.onProgress,
        reject,
        resolve,
      });
      this.worker!.postMessage(request, transfer ?? []);
    });
  }

  private ensureWorker() {
    if (this.worker) return;
    this.worker = (this.options.createWorker ?? createDefaultWorker)();
    this.worker.onmessage = (event: MessageEvent<TranscriptionWorkerResponse>) => {
      const response = event.data;
      const pendingRequest = this.pendingRequests.get(response.id);
      if (!pendingRequest) return;
      if (response.type === 'progress') {
        pendingRequest.onProgress?.(response.progress, response.details);
        return;
      }
      this.pendingRequests.delete(response.id);
      if (response.type === 'error') {
        pendingRequest.reject(new Error(response.message));
        return;
      }
      pendingRequest.resolve(response.text);
    };
    this.worker.onerror = (event) => {
      const error = new Error(event.message || 'Transcription worker failed.');
      for (const pendingRequest of this.pendingRequests.values()) {
        pendingRequest.reject(error);
      }
      this.pendingRequests.clear();
    };
  }
}
