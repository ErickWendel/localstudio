import { expect, test, withIsolatedDevServer } from '../support/journey-test';
import { evaluateLayoutPresetBulletContract } from './layout-preset-bullet-contract-browser';
import { layoutPresetContractFixtures } from './layout-preset-contract-fixtures';
import { layoutPresetContractPage } from './layout-preset-contract-page';

const getServer = withIsolatedDevServer(test);

test('normalizes bullet prompt tasks and applies bullet layout frames in the browser runtime', async ({
  page,
}) => {
  const result = await layoutPresetContractPage.run(
    page,
    getServer().baseURL,
    evaluateLayoutPresetBulletContract,
    {
      pageSize: layoutPresetContractFixtures.pageSize,
      prompt: layoutPresetContractFixtures.bulletPrompt,
      textElement: layoutPresetContractFixtures.createTextElement('bullet', ''),
    },
  );

  expect(result).toEqual({
    bulletCount: 3,
    bulletFrameWidth: 1200,
  });
});
