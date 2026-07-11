import { runPresenterKeyboardVideoJourney } from './presenter-keyboard-video-journey';
import { test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);

test('presents from the editor and controls slides and video with keyboard shortcuts', async ({
  page,
}) => {
  await runPresenterKeyboardVideoJourney(page, getServer().baseURL);
});
