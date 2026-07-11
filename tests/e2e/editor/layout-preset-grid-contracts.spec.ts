import { expect, test, withIsolatedDevServer } from '../support/journey-test';
import { evaluateLayoutPresetGridContract } from './layout-preset-grid-contract-browser';
import { layoutPresetContractFixtures } from './layout-preset-contract-fixtures';
import { layoutPresetContractPage } from './layout-preset-contract-page';

const getServer = withIsolatedDevServer(test);

test('normalizes image grid prompt tasks and applies grid layout frames in the browser runtime', async ({
  page,
}) => {
  const result = await layoutPresetContractPage.run(
    page,
    getServer().baseURL,
    evaluateLayoutPresetGridContract,
    {
      imageElement: layoutPresetContractFixtures.createImageElement('image'),
      pageSize: layoutPresetContractFixtures.pageSize,
      prompt: layoutPresetContractFixtures.gridPrompt,
      textElement: layoutPresetContractFixtures.createTextElement('caption', '', 18),
    },
  );

  expect(result).toEqual({
    captionFill: '#FFFFFF',
    captionX: 120,
    imageCount: 3,
    imageWidth: 500,
  });
});
