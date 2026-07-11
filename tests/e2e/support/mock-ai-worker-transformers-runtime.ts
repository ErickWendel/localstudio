import type { MockAiWorkerPayload } from './mock-ai-worker-types';

export const mockAiWorkerTransformersRuntime = {
  source() {
    return createMockTransformersWorkerRuntime.toString();
  },
};

function createMockTransformersWorkerRuntime(
  payload: MockAiWorkerPayload,
  imageEditingRuntime: {
    emit: (
      worker: { onmessage: ((event: MessageEvent) => void) | null },
      requestId: string,
      message: { type?: string },
    ) => void;
  },
) {
  let promptResponseIndex = 0;
  let elementResponseIndex = 0;

  return {
    handle(
      worker: { onmessage: ((event: MessageEvent) => void) | null },
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
        if (emitControlResult(worker, requestId, message)) return;
        if (emitTextGenerationResult(worker, requestId, message)) return;
        if (emitLanguageDetectionResult(worker, requestId, message)) return;
        imageEditingRuntime.emit(worker, requestId, message);
      });
    },
  };

  function emitControlResult(
    worker: { onmessage: ((event: MessageEvent) => void) | null },
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
    worker.onmessage?.(new MessageEvent('message', { data: { id: requestId, result: undefined, type: 'result' } }));
    return true;
  }

  function emitTextGenerationResult(
    worker: { onmessage: ((event: MessageEvent) => void) | null },
    requestId: string,
    message: { modelId?: string; prompt?: unknown; type?: string },
  ) {
    if (message.type !== 'generate-text') return false;
    const promptText = extractPromptText(message.prompt);
    const promptResponse = String(message.modelId).includes('translategemma')
      ? `[pt] ${promptText}`
      : getGemmaPromptResponse(promptText) ?? getNextPromptResponse();
    worker.onmessage?.(new MessageEvent('message', { data: { id: requestId, result: promptResponse, type: 'result' } }));
    return true;
  }

  function emitLanguageDetectionResult(
    worker: { onmessage: ((event: MessageEvent) => void) | null },
    requestId: string,
    message: { text?: string; type?: string },
  ) {
    if (message.type !== 'detect-language') return false;
    worker.onmessage?.(
      new MessageEvent('message', {
        data: {
          id: requestId,
          result: { language: message.text?.includes('olá') ? 'pt' : 'en', score: 0.93 },
          type: 'result',
        },
      }),
    );
    return true;
  }

  function extractPromptText(prompt: unknown) {
    if (typeof prompt === 'string') return prompt;
    if (!Array.isArray(prompt)) return 'translated text';
    const content = (prompt[0] as { content?: unknown } | undefined)?.content;
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
    if (prompt.includes('GENERATED_SLIDE_TASKS_RESPONSE_SCHEMA') || prompt.includes('"tasks"')) return payload.slideTasks;
    if (prompt.includes('"type":"add-title"')) return payload.slideElements[0];
    if (prompt.includes('"type":"add-subtitle"')) return payload.slideElements[1];
    return undefined;
  }

  function getNextPromptResponse() {
    if (promptResponseIndex === 0) {
      promptResponseIndex += 1;
      return payload.slideTasks;
    }
    promptResponseIndex += 1;
    const response = payload.slideElements[elementResponseIndex] ?? payload.slideElements.at(-1)!;
    elementResponseIndex += 1;
    return response;
  }
}
