/* eslint-disable @typescript-eslint/no-base-to-string, @typescript-eslint/require-await */
export type TransformersFallbackContractResult = {
  fallbackCalls: string[];
  fallbackLanguage: unknown;
  fallbackSegmentationScore: number;
  fallbackText: string;
  runtimeLanguage: unknown;
  runtimeText: string;
};

export async function evaluateTransformersFallbackContract(): Promise<TransformersFallbackContractResult> {
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

    const fallbackCalls: string[] = [];
    const fallbackClient = new TransformersRuntimeClient({
      createWorker: () => {
        throw new Error('worker unavailable');
      },
      fallbackOperations: {
        detectLanguage: async (_modelId, text) => {
          fallbackCalls.push(`detect:${text}`);
          return { language: 'pt', score: 0.77 };
        },
        generateText: async (_modelId, prompt) => {
          fallbackCalls.push(`generate:${String(prompt)}`);
          return 'fallback text';
        },
        preloadImageEditing: async (options) => {
          fallbackCalls.push('preload-image-editing');
          options?.onProgress?.(100);
        },
        removeImageEditing: async () => {
          fallbackCalls.push('remove-image-editing');
        },
        preloadLanguageDetection: async (modelId, options) => {
          fallbackCalls.push(`preload-language:${modelId}`);
          options?.onProgress?.(100);
        },
        preloadTextGeneration: async (modelId, options) => {
          fallbackCalls.push(`preload-text:${modelId}`);
          options?.onProgress?.(100);
        },
        prepareBackgroundRemoval: async (objectUrl, options) => {
          fallbackCalls.push(`prepare:${objectUrl}`);
          options?.onProgress?.(100);
        },
        releaseTextGeneration: async (modelId) => {
          fallbackCalls.push(`release:${modelId}`);
        },
        removeTextGeneration: async (modelId) => {
          fallbackCalls.push(`remove:${modelId}`);
        },
        segmentBackgroundRemoval: async (objectUrl, points) => {
          fallbackCalls.push(`segment:${objectUrl}:${points.length}`);
          return {
            imageInput: { channels: 4, data: new Uint8Array([1, 2, 3, 255]), height: 1, width: 1 },
            subjectMask: { data: new Uint8Array([1]), height: 1, score: 1, width: 1 },
          };
        },
      },
    });
    await fallbackClient.preloadTextGeneration('fallback-llm');
    const fallbackText = await fallbackClient.generateText('fallback-llm', 'fallback prompt');
    await fallbackClient.releaseTextGeneration('fallback-llm');
    await fallbackClient.removeTextGeneration('fallback-llm');
    await fallbackClient.preloadLanguageDetection('fallback-lang');
    const fallbackLanguage = await fallbackClient.detectLanguage('fallback-lang', 'olá');
    await fallbackClient.preloadImageEditing();
    await fallbackClient.prepareBackgroundRemoval('asset://fallback');
    const fallbackSegmentation = await fallbackClient.segmentBackgroundRemoval('asset://fallback', [
      { positive: false, x: 0.1, y: 0.2 },
    ]);
    await fallbackClient.removeImageEditing();

    const textRuntime = new webGpuTextGenerationRuntime.TransformersTextGenerationRuntime(
      fallbackClient,
    );
    await textRuntime.loadTextGenerationModel('runtime-llm');
    await textRuntime.releaseTextGenerationModel('runtime-llm');
    const runtimeText = await textRuntime.generate('runtime-llm', 'runtime prompt');
    await textRuntime.removeTextGenerationModel('runtime-llm');

    const languageRuntime =
      new webGpuLanguageDetectionRuntime.TransformersLanguageDetectionRuntime(fallbackClient);
    await languageRuntime.loadLanguageDetectionModel('runtime-lang');
    const runtimeLanguage = await languageRuntime.detectLanguage('runtime-lang', 'runtime text');

    return {
      fallbackCalls,
      fallbackLanguage,
      fallbackSegmentationScore: fallbackSegmentation.subjectMask.score,
      fallbackText,
      runtimeLanguage,
      runtimeText,
    };
}
