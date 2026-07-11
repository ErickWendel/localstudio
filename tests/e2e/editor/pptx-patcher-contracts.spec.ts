import { expect, test, withIsolatedDevServer } from '../support/journey-test';
import { evaluatePptxPatcherContract } from './pptx-patcher-contract-browser';
import { pptxPatcherContractFixtures } from './pptx-patcher-contract-fixtures';

const getServer = withIsolatedDevServer(test);

test.describe('editor PowerPoint package patcher contracts', () => {
  test('patches crop, transitions, animation timing, and package warnings in the browser runtime', async ({
    page,
  }) => {
    await page.goto(new URL('/editor/?newProject=1', getServer().baseURL).toString());

    const result = await page.evaluate(
      evaluatePptxPatcherContract,
      pptxPatcherContractFixtures.createInput(),
    );

    expect(result.bufferBytes).toBeGreaterThan(0);
    expect(result.warningCodes).toEqual(
      expect.arrayContaining([
        'existing-warning',
        'pptx-animation-effect-downgraded',
        'pptx-animation-target-missing',
      ]),
    );
  });
});
