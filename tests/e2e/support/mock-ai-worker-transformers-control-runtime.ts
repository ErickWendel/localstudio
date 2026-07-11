export const mockAiWorkerTransformersControlRuntime = {
  source() {
    return createMockTransformersControlRuntime.toString();
  },
};

function createMockTransformersControlRuntime() {
  return {
    emit(
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
      worker.onmessage?.(
        new MessageEvent('message', {
          data: { id: requestId, result: undefined, type: 'result' },
        }),
      );
      return true;
    },
  };
}
