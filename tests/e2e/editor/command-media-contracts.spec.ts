import { commandMediaContractRuntimePage } from './command-media-contract-runtime-page';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);

test.describe('editor media command contracts', () => {
  test('executes image, video, playback, replacement, and asset commands in the browser runtime', async ({
    page,
  }) => {
    const result = await commandMediaContractRuntimePage.run(page, getServer().baseURL);

    expect(result).toEqual({
      imageCrop: { height: 0.8, width: 0.7, x: 0.1, y: 0.05 },
      imageFlipped: true,
      remainingAssetIds: ['asset-image-2', 'asset-video', 'asset-video-2'],
      videoDuration: 18,
      videoRepeatMode: 'loop',
    });
  });
});
