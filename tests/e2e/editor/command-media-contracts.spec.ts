import { commandMediaContractRuntimePage } from './command-media-contract-runtime-page';
import { evaluateCommandMediaAssetContract } from './command-media-asset-contract-browser';
import { evaluateCommandMediaImageContract } from './command-media-image-contract-browser';
import { evaluateCommandMediaVideoPlaybackContract } from './command-media-video-playback-contract-browser';
import { evaluateCommandMediaVideoReplacementContract } from './command-media-video-replacement-contract-browser';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);

test.describe('editor media command contracts', () => {
  test('executes image crop, flip, and replacement commands in the browser runtime', async ({
    page,
  }) => {
    const result = await commandMediaContractRuntimePage.run(
      page,
      getServer().baseURL,
      evaluateCommandMediaImageContract,
    );

    expect(result).toEqual({
      imageAssetId: 'asset-image-2',
      imageCrop: { height: 0.8, width: 0.7, x: 0.1, y: 0.05 },
      imageFlipped: true,
    });
  });

  test('executes video playback commands in the browser runtime', async ({
    page,
  }) => {
    const result = await commandMediaContractRuntimePage.run(
      page,
      getServer().baseURL,
      evaluateCommandMediaVideoPlaybackContract,
    );

    expect(result).toEqual({
      videoRepeatMode: 'loop',
      videoTrimEnd: 12,
      videoTrimStart: 2,
      videoVolume: 0.4,
    });
  });

  test('executes video replacement commands in the browser runtime', async ({ page }) => {
    const result = await commandMediaContractRuntimePage.run(
      page,
      getServer().baseURL,
      evaluateCommandMediaVideoReplacementContract,
    );

    expect(result).toEqual({
      videoAssetId: 'asset-video-2',
      videoDuration: 18,
      videoTrimEnd: 18,
      videoTrimStart: 0,
    });
  });

  test('executes media asset cleanup commands in the browser runtime', async ({ page }) => {
    const result = await commandMediaContractRuntimePage.run(
      page,
      getServer().baseURL,
      evaluateCommandMediaAssetContract,
    );

    expect(result).toEqual({
      remainingAssetIds: ['asset-image-2', 'asset-video'],
    });
  });
});
