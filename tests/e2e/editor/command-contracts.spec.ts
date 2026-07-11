import { commandContractRuntimePage } from './command-contract-runtime-page';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);

test.describe('editor element command contracts', () => {
  test('executes element layout, style, text, and deletion commands in the browser runtime', async ({
    page,
  }) => {
    const result = await commandContractRuntimePage.run(page, getServer().baseURL);

    expect(result).toEqual({
      elementCount: 5,
      pageElementIds: ['text-copy', 'text-1', 'image-1', 'shape-1', 'video-1'],
      textFontSize: 46,
    });
  });
});
