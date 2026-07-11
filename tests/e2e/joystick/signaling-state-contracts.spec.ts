import { expect, test, withIsolatedDevServer } from '../support/journey-test';
import { joystickSignalingContractRuntime } from './joystick-signaling-contract-runtime';
import { evaluateJoystickSignalingStateContract } from './signaling-state-contract-browser';

const getServer = withIsolatedDevServer(test);

test('executes joystick signaling state and command contracts in the browser runtime', async ({
  page,
}) => {
  await joystickSignalingContractRuntime.gotoReady(page, getServer().baseURL);

  const result = await page.evaluate(evaluateJoystickSignalingStateContract, {
    sourceRoot: joystickSignalingContractRuntime.presenterRemoteSourceRoot,
  });

  expect(result.stateAccepted).toBe(true);
  expect(result.publishedState).toMatchObject({ connectedControllerCount: 1 });
  expect(result.trustedCommand).toBe(true);
  expect(result.untrustedCommand).toBe(false);
  expect(result.anonymousCommand).toBe(true);
  expect(result.commands).toEqual([
    { command: 'next', type: 'command' },
    { command: 'request-state', type: 'command' },
  ]);
  expect(result.drainedCommands).toEqual([]);
});
