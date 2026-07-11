import { trustedReconnectJourney } from './trusted-reconnect-journey';
import { test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);

test.describe('joystick trusted reconnect journey', () => {
  test('reconnects a trusted phone and controls a non-peer presenter session', async ({ page }) => {
    await trustedReconnectJourney.run(page, getServer().baseURL);
  });
});
