import { commandContractRuntimePage } from './command-contract-runtime-page';
import { evaluateCommandContractFrame } from './command-contract-frame-browser';
import { evaluateCommandContractOrder } from './command-contract-order-browser';
import { evaluateCommandContractTextStyle } from './command-contract-text-style-browser';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);

test.describe('editor element command contracts', () => {
  test('executes element order and visibility commands in the browser runtime', async ({
    page,
  }) => {
    const result = await commandContractRuntimePage.run(
      page,
      getServer().baseURL,
      evaluateCommandContractOrder,
    );

    expect(result).toEqual({
      copyLocked: true,
      copyVisible: false,
      pageElementIds: ['text-copy', 'text-1', 'image-1', 'shape-1', 'video-1'],
    });
  });

  test('executes element frame, batch frame, add, and delete commands in the browser runtime', async ({
    page,
  }) => {
    const result = await commandContractRuntimePage.run(
      page,
      getServer().baseURL,
      evaluateCommandContractFrame,
    );

    expect(result).toEqual({
      imageY: 320,
      missingAssetRetained: true,
      referencedAssetRetained: true,
      removedAssetGone: true,
      shape1X: 100,
      shape2Deleted: true,
    });
  });

  test('executes element text and style commands in the browser runtime', async ({ page }) => {
    const result = await commandContractRuntimePage.run(
      page,
      getServer().baseURL,
      evaluateCommandContractTextStyle,
    );

    expect(result).toEqual({
      elementCount: 4,
      shapeStroke: '#ff00aa',
      text: 'Traduzido',
      textFontSize: 46,
    });
  });
});
