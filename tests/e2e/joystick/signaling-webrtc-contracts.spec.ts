import { expect, test, withIsolatedDevServer } from '../support/journey-test';
import { joystickSignalingContractRuntime } from './joystick-signaling-contract-runtime';

const getServer = withIsolatedDevServer(test);

test('executes joystick signaling WebRTC exchange contracts in the browser runtime', async ({
  page,
}) => {
  await joystickSignalingContractRuntime.gotoReady(page, getServer().baseURL);

  const result = await page.evaluate(async ({ sourceRoot }) => {
    const { InMemoryPresenterRemoteSignalingService } = (await import(
      `${sourceRoot}/signaling-service.ts`
    )) as typeof import('../../../packages/presenter-remote/src/signaling-service');

    const service = new InMemoryPresenterRemoteSignalingService({
      now: () => Date.parse('2026-07-10T12:00:00.000Z'),
      randomCode: () => 'ABCD-1234',
      randomId: () => 'session-joystick',
    });
    const session = service.registerSession({
      presenterDeviceId: 'presenter-laptop',
      presenterLabel: 'Studio laptop',
      ttlMs: 60_000,
    });
    const failedOffer = service.createControllerOffer({
      controllerId: 'phone-1',
      offerSdp: 'untrusted-offer',
      sessionCode: session.code,
    });
    service.connectController(session.code, 'phone-1');
    const acceptedOffer = service.createControllerOffer({
      controllerId: 'phone-1',
      offerSdp: 'trusted-offer',
      sessionCode: session.code,
    });
    const pendingOffers = service.takePendingOffers(session.code);
    const answerAccepted = service.publishAnswer(session.code, 'phone-1', 'presenter-answer');
    const answer = service.getAnswer(session.code, 'phone-1');
    const controllerIceAccepted = service.publishIceCandidate(session.code, 'phone-1', {
      candidate: { candidate: 'candidate-to-controller' },
      target: 'controller',
    });
    const presenterIceAccepted = service.publishIceCandidate(session.code, 'phone-1', {
      candidate: { candidate: 'candidate-to-presenter' },
      target: 'presenter',
    });
    const controllerIce = service.takeIceCandidates(session.code, 'phone-1', 'controller');
    const presenterIce = service.takeIceCandidates(session.code, 'phone-1', 'presenter');
    const drainedPresenterIce = service.takeIceCandidates(session.code, 'phone-1', 'presenter');
    const missingIceAccepted = service.publishIceCandidate(session.code, 'missing-phone', {
      candidate: { candidate: 'missing-candidate' },
      target: 'controller',
    });

    return {
      acceptedOffer,
      answer,
      answerAccepted,
      controllerIce,
      controllerIceAccepted,
      drainedPresenterIce,
      failedOffer,
      missingIceAccepted,
      pendingOffers,
      presenterIce,
      presenterIceAccepted,
    };
  }, { sourceRoot: joystickSignalingContractRuntime.presenterRemoteSourceRoot });

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
