import { expect, test } from '../support/journey-test';
import { modelRuntimeContractPage } from '../support/model-runtime-contract-page';
import { serviceContractsSupport } from './service-contracts-support';

test('executes Transformers text and language extraction contracts in the browser runtime', async ({
  page,
}) => {
  await modelRuntimeContractPage.gotoReady(page, serviceContractsSupport.getServer().baseURL);

  const result = await page.evaluate(async () => {
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
  });

  expect(result).toMatchObject({
    detectedFromNested: { language: 'fr', score: 0.66 },
    extractedNestedText: 'nested assistant text',
  });
  expect(result.textExtractionErrors).toEqual([
    'WebGPU text generation did not return text.',
    'Language detection model did not return a language label.',
  ]);
});
