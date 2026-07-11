import { test, withIsolatedDevServer } from '../support/journey-test';
import { dragReorderJourneyPage } from './drag-reorder-journey-page';

const getServer = withIsolatedDevServer(test);

test.describe('editor drag reorder journeys', () => {
  test('reorders layers, slides, and animation builds with drag and drop', async ({ page }) => {
    await dragReorderJourneyPage.reorderLayersSlidesAndAnimationBuilds(page, getServer().baseURL);
  });
});
