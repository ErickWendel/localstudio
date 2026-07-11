import { expect, test } from '../support/journey-test';
import { modelRuntimeContractPage } from '../support/model-runtime-contract-page';
import { serviceContractsSupport } from './service-contracts-support';

test('executes persisted model readiness contracts in the browser runtime', async ({ page }) => {
  await modelRuntimeContractPage.gotoReady(page, serviceContractsSupport.getServer().baseURL);

  const result = await page.evaluate(async () => {
    const [{ aiModelCatalog }, { imageGenerationModel }, { modelSetupService }] =
      (await Promise.all([
        import('/editor/src/services/model-setup/aiModelCatalog.ts'),
        import('/editor/src/services/image-generation/imageGenerationModel.ts'),
        import('/editor/src/services/model-setup/modelSetupService.ts'),
      ])) as [
        typeof import('../../../apps/editor/src/services/model-setup/aiModelCatalog'),
        typeof import('../../../apps/editor/src/services/image-generation/imageGenerationModel'),
        typeof import('../../../apps/editor/src/services/model-setup/modelSetupService'),
      ];

    const readyStorage = new Map<string, string>([
      [aiModelCatalog.GEMMA_LLM_READY_KEY, 'true'],
      [aiModelCatalog.TRANSLATEGEMMA_READY_KEY, 'true'],
      [aiModelCatalog.LANGUAGE_DETECTION_READY_KEY, 'true'],
      [imageGenerationModel.IMAGE_GENERATION_READY_KEY, 'true'],
    ]);
    const setup = new modelSetupService.BrowserModelSetupService(
      undefined,
      {
        getItem: (key: string) => readyStorage.get(key) ?? null,
      },
      undefined,
      undefined,
      undefined,
      undefined,
    );

    return {
      initiallyReady: (await setup.getModelStates()).filter((state) => state.status === 'ready').length,
    };
  });

  expect(result.initiallyReady).toBeGreaterThanOrEqual(4);
});
