/* eslint-disable @typescript-eslint/require-await */
export type BonsaiRuntimeFallbackContractResult = {
  fallbackBonsaiBlobText: string;
};

export async function evaluateBonsaiRuntimeFallbackContract(): Promise<BonsaiRuntimeFallbackContractResult> {
  const { bonsaiImageRuntime } = (await import(
    '/editor/src/services/image-generation/bonsaiImageRuntime.ts'
  )) as typeof import('../../../apps/editor/src/services/image-generation/bonsaiImageRuntime');

  const fallbackBonsaiRuntime = new bonsaiImageRuntime.WorkerBackedBonsaiImageRuntime({
    createWorker: () => {
      throw new Error('image worker unavailable');
    },
    fallbackRuntime: {
      generate: async (options) => {
        options.onLoadProgress?.(100);
        options.onStep?.(options.steps, options.steps);
        return new Blob([options.prompt], { type: 'image/png' });
      },
      preload: async (_modelId, options) => {
        options?.onProgress?.(100);
      },
    },
  });
  await fallbackBonsaiRuntime.preload('fallback-bonsai');
  const fallbackBonsaiBlob = await fallbackBonsaiRuntime.generate({
    height: 256,
    modelId: 'fallback-bonsai',
    prompt: 'fallback image',
    steps: 1,
    width: 256,
  });

  return {
    fallbackBonsaiBlobText: await fallbackBonsaiBlob.text(),
  };
}
