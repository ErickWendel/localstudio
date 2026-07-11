import { test, withIsolatedDevServer } from '../support/journey-test';
import { canvasTransformJourneyPage } from './canvas-transform-journey-page';

const getServer = withIsolatedDevServer(test);

test.describe('editor canvas transform handles and crop journey', () => {
  test('resizes a text element with canvas handles and keeps arrange controls usable', async ({
    page,
  }) => {
    await canvasTransformJourneyPage.resizeTextAndUseArrangeControls(page, getServer().baseURL);
  });

  test('crops an imported image by dragging crop handles', async ({ page }, testInfo) => {
    await canvasTransformJourneyPage.cropImportedImage(page, getServer().baseURL, testInfo);
  });
});
