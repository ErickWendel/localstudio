import { expect, test } from '../support/journey-test';
import { modelRuntimeContractPage } from '../support/model-runtime-contract-page';
import { serviceContractsSupport } from './service-contracts-support';

test('executes in-memory model setup contracts in the browser runtime', async ({ page }) => {
  await modelRuntimeContractPage.gotoReady(page, serviceContractsSupport.getServer().baseURL);

  const result = await page.evaluate(async () => {
    const { modelSetupService } = (await import(
      '/editor/src/services/model-setup/modelSetupService.ts'
    )) as typeof import('../../../apps/editor/src/services/model-setup/modelSetupService');

    const setup = new modelSetupService.InMemoryModelSetupService();
    const required = await setup.downloadRequiredModels();
    const removed = await setup.removeModel(modelSetupService.IMAGE_EDITING_MODEL_ID);

    return {
      readyCount: required.filter((state) => state.status === 'ready').length,
      removed,
    };
  });

  expect(result.readyCount).toBeGreaterThan(0);
  expect(result.removed).toMatchObject({ progress: 0, status: 'needs-download' });
});
