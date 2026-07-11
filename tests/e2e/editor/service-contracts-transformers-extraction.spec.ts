import { expect, test } from '../support/journey-test';
import { modelRuntimeContractPage } from '../support/model-runtime-contract-page';
import { serviceContractsSupport } from './service-contracts-support';
import { evaluateTransformersExtractionContract } from './transformers-extraction-contract-browser';

test('executes Transformers text and language extraction contracts in the browser runtime', async ({
  page,
}) => {
  await modelRuntimeContractPage.gotoReady(page, serviceContractsSupport.getServer().baseURL);

  const result = await page.evaluate(evaluateTransformersExtractionContract);

  expect(result).toMatchObject({
    detectedFromNested: { language: 'fr', score: 0.66 },
    extractedNestedText: 'nested assistant text',
  });
  expect(result.textExtractionErrors).toEqual([
    'WebGPU text generation did not return text.',
    'Language detection model did not return a language label.',
  ]);
});
