import { movieControlsContractPage } from './movie-controls-contract-page';
import { expect, test } from '../support/journey-test';
import { serviceContractsSupport } from './service-contracts-support';

test('executes presentation movie playback controls in the browser runtime', async ({ page }) => {
  const result = await movieControlsContractPage.run(page, serviceContractsSupport.getServer().baseURL);

  expect(result).toMatchObject({
    consumedBuild: true,
    endTime: 12,
    fastForwardRate: 2,
    movieStarted: true,
    startTime: 2,
  });
});
