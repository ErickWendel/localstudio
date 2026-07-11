export type TransformersExtractionContractResult = {
  detectedFromNested: unknown;
  extractedNestedText: string;
  textExtractionErrors: string[];
};

export async function evaluateTransformersExtractionContract(): Promise<TransformersExtractionContractResult> {
  const [{ webGpuLanguageDetectionRuntime }, { webGpuTextGenerationRuntime }] =
    (await Promise.all([
      import('/editor/src/services/translation/webGpuLanguageDetectionRuntime.ts'),
      import('/editor/src/services/prompting/webGpuTextGenerationRuntime.ts'),
    ])) as [
      typeof import('../../../apps/editor/src/services/translation/webGpuLanguageDetectionRuntime'),
      typeof import('../../../apps/editor/src/services/prompting/webGpuTextGenerationRuntime'),
    ];

  const textExtractionErrors: string[] = [];
  const extractedNestedText = webGpuTextGenerationRuntime.extractGeneratedText([
    { generated_text: [{ content: 'nested assistant text' }] },
  ]);
  try {
    webGpuTextGenerationRuntime.extractGeneratedText([{ generated_text: [{ value: 1 }] }]);
  } catch (error) {
    textExtractionErrors.push(error instanceof Error ? error.message : String(error));
  }
  const detectedFromNested = webGpuLanguageDetectionRuntime.extractDetectedLanguage([
    [{ label: 'fr', score: 0.66 }],
  ]);
  try {
    webGpuLanguageDetectionRuntime.extractDetectedLanguage([{ score: 0.1 }]);
  } catch (error) {
    textExtractionErrors.push(error instanceof Error ? error.message : String(error));
  }

  return {
    detectedFromNested,
    extractedNestedText,
    textExtractionErrors,
  };
}
