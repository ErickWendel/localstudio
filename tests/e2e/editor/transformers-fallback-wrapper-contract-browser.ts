/* eslint-disable @typescript-eslint/no-base-to-string, @typescript-eslint/require-await */
export type TransformersFallbackWrapperContractResult = {
  calls: string[];
  language: unknown;
  text: string;
};

export async function evaluateTransformersFallbackWrapperContract(): Promise<TransformersFallbackWrapperContractResult> {
  const [
    { TransformersRuntimeClient },
    { webGpuLanguageDetectionRuntime },
    { webGpuTextGenerationRuntime },
  ] = (await Promise.all([
    import('/editor/src/services/model-setup/transformersRuntimeClient.ts'),
    import('/editor/src/services/translation/webGpuLanguageDetectionRuntime.ts'),
    import('/editor/src/services/prompting/webGpuTextGenerationRuntime.ts'),
  ])) as [
    typeof import('../../../apps/editor/src/services/model-setup/transformersRuntimeClient'),
    typeof import('../../../apps/editor/src/services/translation/webGpuLanguageDetectionRuntime'),
    typeof import('../../../apps/editor/src/services/prompting/webGpuTextGenerationRuntime'),
  ];

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
      generateText: async (_modelId, prompt) => {
        calls.push(`generate:${String(prompt)}`);
        return 'fallback text';
      },
      preloadLanguageDetection: async (modelId, options) => {
        calls.push(`preload-language:${modelId}`);
        options?.onProgress?.(100);
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

  const textRuntime = new webGpuTextGenerationRuntime.TransformersTextGenerationRuntime(client);
  await textRuntime.loadTextGenerationModel('runtime-llm');
  await textRuntime.releaseTextGenerationModel('runtime-llm');
  const text = await textRuntime.generate('runtime-llm', 'runtime prompt');
  await textRuntime.removeTextGenerationModel('runtime-llm');

  const languageRuntime =
    new webGpuLanguageDetectionRuntime.TransformersLanguageDetectionRuntime(client);
  await languageRuntime.loadLanguageDetectionModel('runtime-lang');
  const language = await languageRuntime.detectLanguage('runtime-lang', 'runtime text');

  return { calls, language, text };
}
