import { bonsaiRuntimeContractPage } from './bonsai-runtime-contract-page';
import { expect, test } from '../support/journey-test';
import { serviceContractsSupport } from './service-contracts-support';

test('executes Bonsai image runtime worker and fallback branches in the browser runtime', async ({
  page,
}) => {
  const result = await bonsaiRuntimeContractPage.run(page, serviceContractsSupport.getServer().baseURL);

  expect(result).toMatchObject({
    bonsaiBlobText: 'image:coverage image',
    bonsaiRequests: ['preload', 'generate'],
    bonsaiSteps: ['1/2'],
    fallbackBonsaiBlobText: 'fallback image',
  });
  expect(result.bonsaiProgress).toContain(60);
});
