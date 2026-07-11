import type { MockAiWorkerPayload } from './mock-ai-worker-types';

export const mockAiWorkerBonsaiRuntime = {
  source() {
    return createMockBonsaiWorkerRuntime.toString();
  },
};

function createMockBonsaiWorkerRuntime(payload: MockAiWorkerPayload) {
  let generateFailuresRemaining = payload.mockOptions.bonsaiGenerateFailures ?? 0;

  return {
    handle(
      worker: { onmessage: ((event: MessageEvent) => void) | null },
      requestId: string,
      message: { options?: { steps?: number }; type?: string },
    ) {
      queueMicrotask(() => {
        worker.onmessage?.(
          new MessageEvent('message', {
            data: { id: requestId, progress: 100, type: 'progress' },
          }),
        );
        if (message.type === 'generate' && generateFailuresRemaining > 0) {
          generateFailuresRemaining -= 1;
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
              blob: new Blob([new Uint8Array(payload.pngBytes)], { type: 'image/png' }),
              id: requestId,
              type: 'result',
            },
          }),
        );
      });
    },
  };
}
