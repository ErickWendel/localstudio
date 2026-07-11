/* eslint-disable @typescript-eslint/require-await */
export type TransformersFallbackImageContractResult = {
  calls: string[];
  segmentationScore: number;
};

export async function evaluateTransformersFallbackImageContract(): Promise<TransformersFallbackImageContractResult> {
  const { TransformersRuntimeClient } = (await import(
    '/editor/src/services/model-setup/transformersRuntimeClient.ts'
  )) as typeof import('../../../apps/editor/src/services/model-setup/transformersRuntimeClient');

  const calls: string[] = [];
  const client = new TransformersRuntimeClient({
    createWorker: () => {
      throw new Error('worker unavailable');
    },
    fallbackOperations: {
      preloadImageEditing: async (options) => {
        calls.push('preload-image-editing');
        options?.onProgress?.(100);
      },
      prepareBackgroundRemoval: async (objectUrl, options) => {
        calls.push(`prepare:${objectUrl}`);
        options?.onProgress?.(100);
      },
      removeImageEditing: async () => {
        calls.push('remove-image-editing');
      },
      segmentBackgroundRemoval: async (objectUrl, points) => {
        calls.push(`segment:${objectUrl}:${points.length}`);
        return {
          imageInput: { channels: 4, data: new Uint8Array([1, 2, 3, 255]), height: 1, width: 1 },
          subjectMask: { data: new Uint8Array([1]), height: 1, score: 1, width: 1 },
        };
      },
    },
  });

  await client.preloadImageEditing();
  await client.prepareBackgroundRemoval('asset://fallback');
  const segmentation = await client.segmentBackgroundRemoval('asset://fallback', [
    { positive: false, x: 0.1, y: 0.2 },
  ]);
  await client.removeImageEditing();

  return { calls, segmentationScore: segmentation.subjectMask.score };
}
