import { animationWorkflowJourney } from './animation-workflow-journey';
import { test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);

test.describe('editor animation workflow journey', () => {
  test('adds, previews, updates, and removes an object animation', async ({ page }) => {
    await animationWorkflowJourney.runObjectAnimationEditLifecycle(page, getServer().baseURL);
  });

  test('builds a mixed text and shape animation sequence from the editor UI', async ({
    page,
  }) => {
    await animationWorkflowJourney.runMixedTextAndShapeSequence(page, getServer().baseURL);
  });

  test('waits for click-triggered builds and advances them from the slide preview', async ({
    page,
  }) => {
    await animationWorkflowJourney.runClickTriggeredBuildPreview(page, getServer().baseURL);
  });
});
