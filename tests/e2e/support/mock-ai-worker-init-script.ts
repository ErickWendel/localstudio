type MockAiWorkerPayload = {
  mockOptions: {
    bonsaiGenerateFailures?: number;
  };
  pngBytes: number[];
  slideElements: string[];
  slideTasks: string;
};

type MockWorkerHandle = {
  onmessage: ((event: MessageEvent) => void) | null;
};

export function mockAiWorkerInitScript({
  mockOptions,
  pngBytes,
  slideElements,
  slideTasks,
}: MockAiWorkerPayload) {
  let promptResponseIndex = 0;
  let elementResponseIndex = 0;
  let bonsaiGenerateFailuresRemaining = mockOptions.bonsaiGenerateFailures ?? 0;
  const originalWorker = window.Worker;

  class MockLocalStudioWorker {
    onerror: ((event: ErrorEvent) => void) | null = null;
    onmessage: ((event: MessageEvent) => void) | null = null;
    readonly url: string;

    constructor(url: string | URL) {
      this.url = String(url);
      if (
        !this.url.includes('bonsaiImageRuntime.worker') &&
        !this.url.includes('transformersRuntime.worker')
      ) {
        return new originalWorker(url) as unknown as MockLocalStudioWorker;
      }
    }

    postMessage(message: {
      id?: string;
      modelId?: string;
      options?: { steps?: number };
      prompt?: unknown;
      text?: string;
      type?: string;
    }) {
      const requestId = message.id ?? 'bonsai-e2e';
      if (this.url.includes('transformersRuntime.worker')) {
        handleTransformersMessage(this, requestId, message);
        return;
      }
      if (this.url.includes('bonsaiImageRuntime.worker')) {
        handleBonsaiMessage(this, requestId, message);
      }
    }

    addEventListener() {
      return undefined;
    }

    removeEventListener() {
      return undefined;
    }

    terminate() {
      return undefined;
    }
  }
  Object.defineProperty(window, 'Worker', { configurable: true, value: MockLocalStudioWorker });

  function handleTransformersMessage(
    worker: MockWorkerHandle,
    requestId: string,
    message: { modelId?: string; prompt?: unknown; text?: string; type?: string },
  ) {
    queueMicrotask(() => {
      worker.onmessage?.(
        new MessageEvent('message', {
          data: {
            details: {
              file: message.modelId ?? message.type ?? 'local-model',
              loaded: 1,
              total: 1,
            },
            id: requestId,
            progress: 100,
            type: 'progress',
          },
        }),
      );
      if (emitTransformersControlResult(worker, requestId, message)) return;
      if (emitTextGenerationResult(worker, requestId, message)) return;
      if (emitLanguageDetectionResult(worker, requestId, message)) return;
      emitImageEditingResult(worker, requestId, message);
    });
  }

  function emitTransformersControlResult(
    worker: MockWorkerHandle,
    requestId: string,
    message: { type?: string },
  ) {
    if (
      message.type !== 'preload-text-generation' &&
      message.type !== 'release-text-generation' &&
      message.type !== 'remove-text-generation' &&
      message.type !== 'preload-language-detection'
    ) {
      return false;
    }
    worker.onmessage?.(
      new MessageEvent('message', {
        data: { id: requestId, result: undefined, type: 'result' },
      }),
    );
    return true;
  }

  function emitTextGenerationResult(
    worker: MockWorkerHandle,
    requestId: string,
    message: { modelId?: string; prompt?: unknown; type?: string },
  ) {
    if (message.type !== 'generate-text') return false;
    const promptText = extractPromptText(message.prompt);
    const promptResponse = String(message.modelId).includes('translategemma')
      ? `[pt] ${promptText}`
      : getGemmaPromptResponse(promptText) ?? getNextPromptResponse();
    worker.onmessage?.(
      new MessageEvent('message', {
        data: { id: requestId, result: promptResponse, type: 'result' },
      }),
    );
    return true;
  }

  function emitLanguageDetectionResult(
    worker: MockWorkerHandle,
    requestId: string,
    message: { text?: string; type?: string },
  ) {
    if (message.type !== 'detect-language') return false;
    worker.onmessage?.(
      new MessageEvent('message', {
        data: {
          id: requestId,
          result: {
            language: message.text?.includes('olá') ? 'pt' : 'en',
            score: 0.93,
          },
          type: 'result',
        },
      }),
    );
    return true;
  }

  function emitImageEditingResult(
    worker: MockWorkerHandle,
    requestId: string,
    message: { type?: string },
  ) {
    if (
      message.type === 'preload-image-editing' ||
      message.type === 'prepare-background-removal' ||
      message.type === 'remove-image-editing'
    ) {
      worker.onmessage?.(
        new MessageEvent('message', {
          data: { id: requestId, result: undefined, type: 'result' },
        }),
      );
      return;
    }
    if (message.type !== 'segment-background-removal') return;
    worker.onmessage?.(
      new MessageEvent('message', {
        data: {
          id: requestId,
          result: {
            imageInput: {
              channels: 4,
              data: [55, 253, 118, 255, 5, 13, 16, 255, 255, 255, 255, 255, 0, 119, 154, 255],
              height: 2,
              width: 2,
            },
            subjectMask: {
              data: [1, 0, 0, 1],
              height: 2,
              score: 0.92,
              width: 2,
            },
          },
          type: 'result',
        },
      }),
    );
  }

  function handleBonsaiMessage(
    worker: MockWorkerHandle,
    requestId: string,
    message: { options?: { steps?: number }; type?: string },
  ) {
    queueMicrotask(() => {
      worker.onmessage?.(
        new MessageEvent('message', {
          data: { id: requestId, progress: 100, type: 'progress' },
        }),
      );
      if (message.type === 'generate' && bonsaiGenerateFailuresRemaining > 0) {
        bonsaiGenerateFailuresRemaining -= 1;
        worker.onmessage?.(
          new MessageEvent('message', {
            data: {
              id: requestId,
              message: 'Mock Bonsai image generation failed.',
              type: 'error',
            },
          }),
        );
        return;
      }
      const steps = Math.max(1, message.options?.steps ?? 1);
      worker.onmessage?.(
        new MessageEvent('message', {
          data: { id: requestId, step: steps, totalSteps: steps, type: 'step' },
        }),
      );
      worker.onmessage?.(
        new MessageEvent('message', {
          data: {
            blob: new Blob([new Uint8Array(pngBytes)], { type: 'image/png' }),
            id: requestId,
            type: 'result',
          },
        }),
      );
    });
  }

  function extractPromptText(prompt: unknown) {
    if (typeof prompt === 'string') return prompt;
    if (!Array.isArray(prompt)) return 'translated text';
    const firstMessage = prompt[0] as { content?: unknown } | undefined;
    const content = firstMessage?.content;
    if (Array.isArray(content)) {
      const textItem = content.find(
        (item): item is { text: string } =>
          Boolean(item && typeof item === 'object' && typeof (item as { text?: unknown }).text === 'string'),
      );
      return textItem?.text ?? 'translated text';
    }
    return typeof content === 'string' ? content : 'translated text';
  }

  function getGemmaPromptResponse(prompt: string) {
    if (prompt.includes('GENERATED_SLIDE_TASKS_RESPONSE_SCHEMA') || prompt.includes('"tasks"')) {
      return slideTasks;
    }
    if (prompt.includes('"type":"add-title"')) return slideElements[0];
    if (prompt.includes('"type":"add-subtitle"')) return slideElements[1];
    return undefined;
  }

  function getNextPromptResponse() {
    if (promptResponseIndex === 0) {
      promptResponseIndex += 1;
      return slideTasks;
    }
    promptResponseIndex += 1;
    const response = slideElements[elementResponseIndex] ?? slideElements.at(-1)!;
    elementResponseIndex += 1;
    return response;
  }
}
