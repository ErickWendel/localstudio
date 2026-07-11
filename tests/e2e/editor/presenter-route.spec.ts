import { runPresenterRouteJourney } from './presenter-route-journey';
import { test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);

test.describe('editor routed presenter journey', () => {
  test('opens a routed presenter window and responds to editor state and timer commands', async ({
    page,
  }) => {
    await runPresenterRouteJourney(page, getServer().baseURL);
  });
});
