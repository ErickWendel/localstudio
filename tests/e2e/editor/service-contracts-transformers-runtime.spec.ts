import { transformersRuntimeContractPage } from './transformers-runtime-contract-page';
import { expect, test } from '../support/journey-test';
import { serviceContractsSupport } from './service-contracts-support';

test('executes Transformers runtime worker branches in the browser runtime', async ({ page }) => {
  const result = await transformersRuntimeContractPage.runWorkerBranchContract(
    page,
    serviceContractsSupport.getServer().baseURL,
  );

  expect(result).toMatchObject({
    detectedLanguage: { language: 'es', score: 0.92 },
    generatedText: 'generated:hello',
    segmentationScore: 0.87,
    workerRequests: [
      'preload-text-generation',
      'generate-text',
      'release-text-generation',
      'remove-text-generation',
      'preload-language-detection',
      'detect-language',
      'preload-image-editing',
      'prepare-background-removal',
      'segment-background-removal',
      'remove-image-editing',
    ],
  });
  expect(result.workerProgressEvents).toEqual(
    expect.arrayContaining([expect.objectContaining({ progress: 50 })]),
  );
});
