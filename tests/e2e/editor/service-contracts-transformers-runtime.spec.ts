import { transformersRuntimeContractPage } from './transformers-runtime-contract-page';
import { expect, test } from '../support/journey-test';
import { serviceContractsSupport } from './service-contracts-support';

test('executes Transformers text generation worker branches in the browser runtime', async ({
  page,
}) => {
  const result = await transformersRuntimeContractPage.runTextWorkerContract(
    page,
    serviceContractsSupport.getServer().baseURL,
  );

  expect(result).toMatchObject({
    generatedText: 'generated:hello',
    requests: [
      'preload-text-generation',
      'generate-text',
      'release-text-generation',
      'remove-text-generation',
    ],
  });
  expect(result.progressEvents).toEqual(
    expect.arrayContaining([expect.objectContaining({ progress: 50 })]),
  );
});

test('executes Transformers language detection worker branches in the browser runtime', async ({
  page,
}) => {
  const result = await transformersRuntimeContractPage.runLanguageWorkerContract(
    page,
    serviceContractsSupport.getServer().baseURL,
  );

  expect(result).toMatchObject({
    detectedLanguage: { language: 'es', score: 0.92 },
    requests: ['preload-language-detection', 'detect-language'],
  });
  expect(result.progressEvents).toEqual(
    expect.arrayContaining([expect.objectContaining({ progress: 50 })]),
  );
});

test('executes Transformers image editing worker branches in the browser runtime', async ({
  page,
}) => {
  const result = await transformersRuntimeContractPage.runImageEditingWorkerContract(
    page,
    serviceContractsSupport.getServer().baseURL,
  );

  expect(result).toMatchObject({
    requests: [
      'preload-image-editing',
      'prepare-background-removal',
      'segment-background-removal',
      'remove-image-editing',
    ],
    segmentationScore: 0.87,
  });
  expect(result.progressEvents).toEqual(
    expect.arrayContaining([expect.objectContaining({ progress: 50 })]),
  );
});
