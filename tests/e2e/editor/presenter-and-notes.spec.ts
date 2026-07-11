import { runPresenterAndNotesJourney } from './presenter-and-notes-journey';
import { test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);

test.describe('editor presenter notes journey', () => {
  test('writes notes and verifies presenter controls without requiring an external display', async ({ page }) => {
    await runPresenterAndNotesJourney(page, getServer().baseURL);
  });
});
