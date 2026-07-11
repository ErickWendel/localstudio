import type { MockAiWorkerPayload } from './mock-ai-worker-types';

type MockTransformersRuntime = {
  emit: (
    worker: { onmessage: ((event: MessageEvent) => void) | null },
    requestId: string,
    message: { modelId?: string; prompt?: unknown; text?: string; type?: string },
  ) => boolean | void;
};

export const mockAiWorkerTransformersRuntime = {
  source() {
    return createMockTransformersWorkerRuntime.toString();
  },
};

function createMockTransformersWorkerRuntime(
  payload: MockAiWorkerPayload,
  controlRuntime: MockTransformersRuntime,
  textRuntime: MockTransformersRuntime,
  languageRuntime: MockTransformersRuntime,
  imageEditingRuntime: MockTransformersRuntime,
) {
  void payload;

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
        if (controlRuntime.emit(worker, requestId, message)) return;
        if (textRuntime.emit(worker, requestId, message)) return;
        if (languageRuntime.emit(worker, requestId, message)) return;
        imageEditingRuntime.emit(worker, requestId, message);
      });
    },
  };
}
