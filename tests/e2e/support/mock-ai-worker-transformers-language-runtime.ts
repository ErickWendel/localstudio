export const mockAiWorkerTransformersLanguageRuntime = {
  source() {
    return createMockTransformersLanguageRuntime.toString();
  },
};

function createMockTransformersLanguageRuntime() {
  return {
    emit(
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
    },
  };
}
