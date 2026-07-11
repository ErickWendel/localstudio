export const mockAiWorkerImageEditingRuntime = {
  source() {
    return createMockImageEditingRuntime.toString();
  },
};

function createMockImageEditingRuntime() {
  return {
    emit(worker: { onmessage: ((event: MessageEvent) => void) | null }, requestId: string, message: { type?: string }) {
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
              subjectMask: { data: [1, 0, 0, 1], height: 2, score: 0.92, width: 2 },
            },
            type: 'result',
          },
        }),
      );
    },
  };
}
