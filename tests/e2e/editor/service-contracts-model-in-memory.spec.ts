import { expect, test } from '../support/journey-test';
import { modelRuntimeContractPage } from '../support/model-runtime-contract-page';
import { evaluateModelInMemoryContract } from './model-in-memory-contract-browser';
import { serviceContractsSupport } from './service-contracts-support';

test('executes in-memory model setup contracts in the browser runtime', async ({ page }) => {
  await modelRuntimeContractPage.gotoReady(page, serviceContractsSupport.getServer().baseURL);

  const result = await page.evaluate(evaluateModelInMemoryContract);

  expect(result.readyCount).toBeGreaterThan(0);
  expect(result.removed).toMatchObject({ progress: 0, status: 'needs-download' });
});
