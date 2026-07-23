import { expect, test } from '../support/journey-test';
import { modelRuntimeContractPage } from '../support/model-runtime-contract-page';
import { evaluateModelReadinessContract } from './model-readiness-contract-browser';
import { serviceContractsSupport } from './service-contracts-support';

test('executes persisted model readiness contracts in the browser runtime', async ({ page }) => {
  await modelRuntimeContractPage.gotoReady(page, serviceContractsSupport.getServer().baseURL);

  const result = await page.evaluate(evaluateModelReadinessContract);

  expect(result.initiallyReady).toBeGreaterThanOrEqual(4);
  expect(result.loaderCalls).toEqual([
    'preload-text:contract-text-model',
    'text-progress:73',
    'release-text:contract-text-model',
    'remove-text:contract-text-model',
    'preload-language:contract-language-model',
    'language-progress:64',
    'remove-image-editing',
  ]);
  expect(result.cacheDeletedUrls).toEqual([
    'https://models.example.test/onnx-community/gemma-4-E2B-it-ONNX/model.onnx',
  ]);
  expect(result.downloadCalls).toEqual(
    expect.arrayContaining([
      'image-editing',
      'image-generation',
      'text:onnx-community/gemma-4-E2B-it-ONNX',
      'release:onnx-community/gemma-4-E2B-it-ONNX',
      'text:onnx-community/translategemma-text-4b-it-ONNX',
      'language:onnx-community/xlm-roberta-base-language-detection-ONNX',
    ]),
  );
  expect(result.failureState).toBe('translategemma failed');
  expect(result.progressValues).toEqual(expect.arrayContaining([44, 55, 66, 77, 100]));
  expect(result.removedStates).toEqual([
    'needs-download',
    'needs-download',
    'needs-download',
    'needs-download',
  ]);
  expect(result.storageWrites).toEqual(
    expect.arrayContaining([
      expect.stringContaining('gemma-4-webgpu-llm.ready:true'),
      expect.stringContaining('translategemma-webgpu.ready:false'),
      expect.stringContaining('language-detection-webgpu.ready:true'),
      expect.stringContaining('image-generation-models.runtime-v1.ready:true'),
    ]),
  );
  expect(result.unknownDownloadMessage).toBe('Unknown model: missing-model');
  expect(result.unknownRemoveMessage).toBe('Unknown model: missing-model');
});
