import { expect, test, withIsolatedDevServer } from '../support/journey-test';
import { evaluateLayoutPresetTitleContract } from './layout-preset-title-contract-browser';
import { layoutPresetContractFixtures } from './layout-preset-contract-fixtures';
import { layoutPresetContractPage } from './layout-preset-contract-page';

const getServer = withIsolatedDevServer(test);

test('normalizes title prompt tasks and applies centered title frames in the browser runtime', async ({
  page,
}) => {
  const result = await layoutPresetContractPage.run(
    page,
    getServer().baseURL,
    evaluateLayoutPresetTitleContract,
    {
      pageSize: layoutPresetContractFixtures.pageSize,
      prompt: layoutPresetContractFixtures.titlePrompt,
    },
  );

  expect(result).toEqual({
    subtitleText: '',
    titleFill: '#22D3EE',
    titleText: undefined,
  });
});
