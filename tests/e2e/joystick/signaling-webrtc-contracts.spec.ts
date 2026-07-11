import { expect, test, withIsolatedDevServer } from '../support/journey-test';
import { joystickSignalingContractRuntime } from './joystick-signaling-contract-runtime';
import { evaluateJoystickSignalingWebRtcContract } from './signaling-webrtc-contract-browser';

const getServer = withIsolatedDevServer(test);

test('executes joystick signaling WebRTC exchange contracts in the browser runtime', async ({
  page,
}) => {
  await joystickSignalingContractRuntime.gotoReady(page, getServer().baseURL);

  const result = await page.evaluate(evaluateJoystickSignalingWebRtcContract, {
    sourceRoot: joystickSignalingContractRuntime.presenterRemoteSourceRoot,
  });

  expect(result.failedOffer).toEqual({ status: 'not-found' });
  expect(result.acceptedOffer).toEqual({ status: 'pending' });
  expect(result.pendingOffers).toEqual([{ controllerId: 'phone-1', offerSdp: 'trusted-offer' }]);
  expect(result.answerAccepted).toBe(true);
  expect(result.answer).toBe('presenter-answer');
  expect(result.controllerIceAccepted).toBe(true);
  expect(result.presenterIceAccepted).toBe(true);
  expect(result.controllerIce).toEqual([{ candidate: 'candidate-to-controller' }]);
  expect(result.presenterIce).toEqual([{ candidate: 'candidate-to-presenter' }]);
  expect(result.drainedPresenterIce).toEqual([]);
  expect(result.missingIceAccepted).toBe(false);
});
