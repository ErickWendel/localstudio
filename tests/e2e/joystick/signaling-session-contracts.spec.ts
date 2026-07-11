import { expect, test, withIsolatedDevServer } from '../support/journey-test';
import { joystickSignalingContractRuntime } from './joystick-signaling-contract-runtime';
import { evaluateJoystickSignalingSessionContract } from './signaling-session-contract-browser';

const getServer = withIsolatedDevServer(test);

test('executes joystick signaling session lifecycle contracts in the browser runtime', async ({
  page,
}) => {
  await joystickSignalingContractRuntime.gotoReady(page, getServer().baseURL);

  const result = await page.evaluate(evaluateJoystickSignalingSessionContract, {
    sourceRoot: joystickSignalingContractRuntime.presenterRemoteSourceRoot,
  });

  expect(result.listedBeforePairing).toHaveLength(1);
  expect(result.missingConnection).toBeUndefined();
  expect(result.connected).toMatchObject({ connectedControllerCount: 1 });
  expect(result.controllerClosed).toBe(true);
  expect(result.afterControllerClose).toMatchObject({ connectedControllerCount: 0 });
  expect(result.missingControllerClosed).toBe(false);
  expect(result.closed).toBe(true);
  expect(result.closedAgain).toBe(false);
});
