import { expect, test } from '../support/journey-test';
import { animationPresetContractPage } from './animation-preset-contract-page';
import { serviceContractsSupport } from './service-contracts-support';

test('executes animation preset contracts in the browser runtime', async ({ page }) => {
  const result = await animationPresetContractPage.run(
    page,
    serviceContractsSupport.getServer().baseURL,
  );

  expect(result.animationCanonicalEffects).toContain('fade-and-move');
  expect(result.animationMaskTotal).toBeGreaterThan(10);
  expect(result.animationParticleTotal).toBeGreaterThan(20);
  expect(result.sideMaskCounts).toEqual([1, 1, 1, 1]);
});
