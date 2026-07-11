import { expect, test, withIsolatedDevServer } from '../support/journey-test';
import { layoutPresetBulletContractPage } from './layout-preset-bullet-contract-page';

const getServer = withIsolatedDevServer(test);

test('normalizes bullet prompt tasks and applies bullet layout frames in the browser runtime', async ({
  page,
}) => {
  const result = await layoutPresetBulletContractPage.run(page, getServer().baseURL);

  expect(result).toEqual({
    bulletCount: 3,
    bulletFrameWidth: 1200,
  });
});
