import { expect, test } from '../support/journey-test';
import { presenterSignalingContractPage } from './presenter-signaling-contract-page';
import { serviceContractsSupport } from './service-contracts-support';

test('executes presenter signaling WebRTC exchange contracts in the browser runtime', async ({
  page,
}) => {
  await presenterSignalingContractPage.gotoReady(page, serviceContractsSupport.getServer().baseURL);

  const result = await page.evaluate(async ({ presenterRemoteSourceRoot }) => {
    const { InMemoryPresenterRemoteSignalingService } = (await import(
      `${presenterRemoteSourceRoot}/signaling-service.ts`
    )) as typeof import('../../../packages/presenter-remote/src/signaling-service');

    const service = new InMemoryPresenterRemoteSignalingService({
      now: () => Date.parse('2026-07-09T12:00:00.000Z'),
      randomCode: () => 'ABCD-1234',
      randomId: () => 'session-1',
    });
    const session = service.registerSession({
      presenterDeviceId: 'presenter-device',
      presenterLabel: 'Main stage',
      ttlMs: 60_000,
    });
    service.connectController(session.code, 'controller-1');
    const trustedOffer = service.createControllerOffer({
      controllerId: 'controller-1',
      offerSdp: 'offer-sdp',
      sessionCode: session.code,
    });
    const untrustedOffer = service.createControllerOffer({
      controllerId: 'controller-2',
      offerSdp: 'ignored-offer',
      sessionCode: session.code,
    });
    const missingOffer = service.createControllerOffer({
      controllerId: 'controller-1',
      offerSdp: 'missing-offer',
      sessionCode: '000000',
    });
    const pendingOffers = service.takePendingOffers(session.code);
    const missingAnswerPublished = service.publishAnswer(session.code, 'controller-2', 'answer-sdp');
    const answerPublished = service.publishAnswer(session.code, 'controller-1', 'answer-sdp');
    const answer = service.getAnswer(session.code, 'controller-1');
    const presenterIcePublished = service.publishIceCandidate(session.code, 'controller-1', {
      candidate: { candidate: 'controller-candidate' },
      target: 'presenter',
    });
    const controllerIcePublished = service.publishIceCandidate(session.code, 'controller-1', {
      candidate: { candidate: 'presenter-candidate' },
      target: 'controller',
    });
    const presenterCandidates = service.takeIceCandidates(session.code, 'controller-1', 'presenter');
    const controllerCandidates = service.takeIceCandidates(session.code, 'controller-1', 'controller');
    const drainedCandidates = service.takeIceCandidates(session.code, 'controller-1', 'presenter');
    const missingIce = service.publishIceCandidate(session.code, 'missing-controller', {
      candidate: { candidate: 'missing' },
      target: 'controller',
    });

    return {
      answer,
      answerPublished,
      controllerCandidates,
      controllerIcePublished,
      drainedCandidates,
      missingAnswerPublished,
      missingIce,
      missingOffer,
      pendingOffers,
      presenterCandidates,
      presenterIcePublished,
      trustedOffer,
      untrustedOffer,
    };
  }, { presenterRemoteSourceRoot: serviceContractsSupport.presenterRemoteSourceRoot });

  expect(result).toMatchObject({
    answer: 'answer-sdp',
    answerPublished: true,
    controllerIcePublished: true,
    drainedCandidates: [],
    missingAnswerPublished: false,
    missingIce: false,
    missingOffer: { status: 'not-found' },
    presenterIcePublished: true,
    trustedOffer: { status: 'pending' },
    untrustedOffer: { status: 'not-found' },
  });
  expect(result.controllerCandidates).toEqual([{ candidate: 'presenter-candidate' }]);
  expect(result.pendingOffers).toEqual([{ controllerId: 'controller-1', offerSdp: 'offer-sdp' }]);
  expect(result.presenterCandidates).toEqual([{ candidate: 'controller-candidate' }]);
});
