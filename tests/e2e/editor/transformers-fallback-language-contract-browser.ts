/* eslint-disable @typescript-eslint/require-await */
export type TransformersFallbackLanguageContractResult = {
  calls: string[];
  language: unknown;
};

export async function evaluateTransformersFallbackLanguageContract(): Promise<TransformersFallbackLanguageContractResult> {
  const { TransformersRuntimeClient } = (await import(
    '/editor/src/services/model-setup/transformersRuntimeClient.ts'
  )) as typeof import('../../../apps/editor/src/services/model-setup/transformersRuntimeClient');

  const calls: string[] = [];
  const client = new TransformersRuntimeClient({
    createWorker: () => {
      throw new Error('worker unavailable');
    },
    fallbackOperations: {
      detectLanguage: async (_modelId, text) => {
        calls.push(`detect:${text}`);
        return { language: 'pt', score: 0.77 };
      },
      preloadLanguageDetection: async (modelId, options) => {
        calls.push(`preload-language:${modelId}`);
        options?.onProgress?.(100);
      },
    },
  });

  await client.preloadLanguageDetection('fallback-lang');
  const language = await client.detectLanguage('fallback-lang', 'ola');

  return { calls, language };
}
