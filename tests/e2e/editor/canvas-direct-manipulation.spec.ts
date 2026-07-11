import { canvasDirectManipulationJourney } from './canvas-direct-manipulation-journey';
import { test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);

test.describe('editor canvas direct manipulation journey', () => {
  test('selects multiple slide elements with a marquee drag', async ({ page }) => {
    await canvasDirectManipulationJourney.runMarqueeSelection(page, getServer().baseURL);
  });

  test('drags a selected canvas element and verifies transform controls stay in sync', async ({
    page,
  }) => {
    await canvasDirectManipulationJourney.runElementDrag(page, getServer().baseURL);
  });
});
