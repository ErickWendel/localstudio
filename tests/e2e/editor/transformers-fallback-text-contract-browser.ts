/* eslint-disable @typescript-eslint/no-base-to-string, @typescript-eslint/require-await */
export type TransformersFallbackTextContractResult = {
  calls: string[];
  text: string;
};

export async function evaluateTransformersFallbackTextContract(): Promise<TransformersFallbackTextContractResult> {
  const { TransformersRuntimeClient } = (await import(
    '/editor/src/services/model-setup/transformersRuntimeClient.ts'
  )) as typeof import('../../../apps/editor/src/services/model-setup/transformersRuntimeClient');

  const calls: string[] = [];
  const client = new TransformersRuntimeClient({
    createWorker: () => {
      throw new Error('worker unavailable');
    },
    fallbackOperations: {
      generateText: async (_modelId, prompt) => {
        calls.push(`generate:${String(prompt)}`);
        return 'fallback text';
      },
      preloadTextGeneration: async (modelId, options) => {
        calls.push(`preload-text:${modelId}`);
        options?.onProgress?.(100);
      },
      releaseTextGeneration: async (modelId) => {
        calls.push(`release:${modelId}`);
      },
      removeTextGeneration: async (modelId) => {
        calls.push(`remove:${modelId}`);
      },
    },
  });

  await client.preloadTextGeneration('fallback-llm');
  const text = await client.generateText('fallback-llm', 'fallback prompt');
  await client.releaseTextGeneration('fallback-llm');
  await client.removeTextGeneration('fallback-llm');

  return { calls, text };
}
