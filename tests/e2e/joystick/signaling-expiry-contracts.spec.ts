import { expect, test, withIsolatedDevServer } from '../support/journey-test';
import { joystickSignalingContractRuntime } from './joystick-signaling-contract-runtime';
import { evaluateJoystickSignalingExpiryContract } from './signaling-expiry-contract-browser';

const getServer = withIsolatedDevServer(test);

test('executes joystick signaling expiry contracts in the browser runtime', async ({ page }) => {
  await joystickSignalingContractRuntime.gotoReady(page, getServer().baseURL);

  const result = await page.evaluate(evaluateJoystickSignalingExpiryContract, {
    sourceRoot: joystickSignalingContractRuntime.presenterRemoteSourceRoot,
  });

  expect(result.expiredLookup).toBeUndefined();
});
