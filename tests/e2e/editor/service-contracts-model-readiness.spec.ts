import { expect, test } from '../support/journey-test';
import { modelRuntimeContractPage } from '../support/model-runtime-contract-page';
import { evaluateModelReadinessContract } from './model-readiness-contract-browser';
import { serviceContractsSupport } from './service-contracts-support';

test('executes persisted model readiness contracts in the browser runtime', async ({ page }) => {
  await modelRuntimeContractPage.gotoReady(page, serviceContractsSupport.getServer().baseURL);

  const result = await page.evaluate(evaluateModelReadinessContract);

  expect(result.initiallyReady).toBeGreaterThanOrEqual(4);
});
