import { expect, test } from '../support/journey-test';
import { evaluatePresenterSignalingExpiryContract } from './presenter-signaling-expiry-contract-browser';
import { presenterSignalingContractPage } from './presenter-signaling-contract-page';
import { serviceContractsSupport } from './service-contracts-support';

test('executes presenter signaling expiry contracts in the browser runtime', async ({ page }) => {
  const result = await presenterSignalingContractPage.run(
    page,
    serviceContractsSupport.getServer().baseURL,
    evaluatePresenterSignalingExpiryContract,
    { presenterRemoteSourceRoot: serviceContractsSupport.presenterRemoteSourceRoot },
  );

  expect(result).toMatchObject({
    activeAfterExpiryCount: 0,
    lookupAfterExpiry: undefined,
  });
});
