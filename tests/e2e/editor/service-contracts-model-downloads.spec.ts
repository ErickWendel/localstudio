import { modelDownloadContractPage } from './model-download-contract-page';
import { expect, test } from '../support/journey-test';
import { serviceContractsSupport } from './service-contracts-support';

test.describe('browser model setup contracts', () => {
  test('downloads supported model families in the browser runtime', async ({ page }) => {
    const result = await modelDownloadContractPage.runDownloadContract(
      page,
      serviceContractsSupport.getServer().baseURL,
    );

    expect(result).toMatchObject({
      imageEditingState: { progress: 100, status: 'ready' },
      imageGenerationState: { progress: 100, status: 'ready' },
      languageState: { progress: 100, status: 'ready' },
      llmState: { progress: 100, status: 'ready' },
      translationState: { progress: 100, status: 'ready' },
    });
    expect(result.modelLoads).toEqual(
      expect.arrayContaining(['image-editing', 'image-generation', expect.stringMatching(/^text:/)]),
    );
    expect(result.storageWrites).toEqual(expect.arrayContaining([expect.stringMatching(/:true$/)]));
  });

  test('removes downloaded models and artifacts in the browser runtime', async ({ page }) => {
    const result = await modelDownloadContractPage.runRemovalContract(
      page,
      serviceContractsSupport.getServer().baseURL,
    );

    expect(result).toMatchObject({
      removedImageEditing: { progress: 0, status: 'needs-download' },
      removedImageGeneration: { progress: 0, status: 'needs-download' },
      removedLlm: { progress: 0, status: 'needs-download' },
      removedTranslation: { progress: 0, status: 'needs-download' },
    });
    expect(result.modelLoads).toEqual(
      expect.arrayContaining(['remove-image-editing', expect.stringMatching(/^delete:/)]),
    );
  });

  test('reports download failures in the browser runtime', async ({ page }) => {
    const result = await modelDownloadContractPage.runFailureContract(
      page,
      serviceContractsSupport.getServer().baseURL,
    );

    expect(result.failedState).toMatchObject({
      error: 'image editing failed',
      progress: 0,
      status: 'failed',
    });
  });
});
