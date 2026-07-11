import { expect, test, withIsolatedDevServer } from '../support/journey-test';
import { layoutPresetTitleContractPage } from './layout-preset-title-contract-page';

const getServer = withIsolatedDevServer(test);

test('normalizes title prompt tasks and applies centered title frames in the browser runtime', async ({
  page,
}) => {
  const result = await layoutPresetTitleContractPage.run(page, getServer().baseURL);

  expect(result).toEqual({
    subtitleText: '',
    titleFill: '#22D3EE',
    titleText: undefined,
  });
});
