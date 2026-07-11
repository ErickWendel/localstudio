import { expect, test, withIsolatedDevServer } from '../support/journey-test';
import { layoutPresetGridContractPage } from './layout-preset-grid-contract-page';

const getServer = withIsolatedDevServer(test);

test('normalizes image grid prompt tasks and applies grid layout frames in the browser runtime', async ({
  page,
}) => {
  const result = await layoutPresetGridContractPage.run(page, getServer().baseURL);

  expect(result).toEqual({
    captionFill: '#FFFFFF',
    captionX: 120,
    imageCount: 3,
    imageWidth: 500,
  });
});
