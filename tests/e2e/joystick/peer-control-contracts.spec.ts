import { expect, test, withIsolatedDevServer } from '../support/journey-test';
import { joystickSignalingContractRuntime } from './joystick-signaling-contract-runtime';
import { evaluateJoystickPeerControlContract } from './peer-control-contract-browser';

const getServer = withIsolatedDevServer(test);

test('executes joystick PeerJS transport contracts in the browser runtime', async ({
  page,
}) => {
  await joystickSignalingContractRuntime.gotoReady(page, getServer().baseURL);

  const result = await page.evaluate(evaluateJoystickPeerControlContract, {
    sourceRoot: joystickSignalingContractRuntime.presenterRemoteSourceRoot,
    testSupportSourceRoot: joystickSignalingContractRuntime.testSupportSourceRoot,
  });

  expect(result.session).toMatchObject({
    code: 'control-peer-1',
    connectedControllerCount: 0,
    controlPeerId: 'control-peer-1',
    presenterDeviceId: 'presenter-device-1',
    presenterLabel: 'Studio laptop',
    transport: 'peerjs',
  });
  expect(result.commandCount).toBe(1);
  expect(result.initialStateMessages).toBeGreaterThanOrEqual(3);
  expect(result.previewMessages).toBe(1);
  expect(result.publishedStateMessages).toBeGreaterThanOrEqual(3);
  expect(result.requestedStateMessages).toBeGreaterThanOrEqual(1);
  expect(result.closedConnectionCount).toBe(1);
  expect(result.connectionRemovedAfterError).toBe(true);
  expect(result.destroyedPeerCount).toBe(2);
  expect(result.streamPeerId).toBe('stream-peer-1');
  expect(result.answeredStreamCall).toBe(true);
  expect(result.callClosed).toBe(true);
  expect(result.callErrored).toBe(true);
  expect(result.timeoutMessage).toBe('expected timeout');
  expect(result.peerOpenResolved).toBe(true);
  expect(result.clientStatuses).toEqual(['connecting', 'connected', 'failed']);
  expect(result.clientRequestStateSent).toBe(true);
  expect(result.clientPreviewBatchCount).toBe(1);
  expect(result.clientStateCount).toBe(1);
  expect(result.clientCommandSent).toBe(true);
  expect(result.clientCommandFailed).toBe(true);
  expect(result.receiverStatuses.slice(0, 2)).toEqual(['connecting', 'connected']);
  expect(result.receiverStatuses.filter((status) => status === 'failed')).toHaveLength(3);
  expect(result.receiverGotStream).toBe(true);
  expect(result.receiverClearedStream).toBe(true);
});
