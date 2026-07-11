import { type Page } from '@playwright/test';

import { presenterSignalingContractPage } from './presenter-signaling-contract-page';

type PresenterSignalingWebRtcContractResult = {
  answer: string | null;
  answerPublished: boolean;
  controllerCandidates: Array<{ candidate: string }>;
  controllerIcePublished: boolean;
  drainedCandidates: Array<{ candidate: string }>;
  missingAnswerPublished: boolean;
  missingIce: boolean;
  missingOffer: { status: string };
  pendingOffers: Array<{ controllerId: string; offerSdp: string }>;
  presenterCandidates: Array<{ candidate: string }>;
  presenterIcePublished: boolean;
  trustedOffer: { status: string };
  untrustedOffer: { status: string };
};

export const presenterSignalingWebRtcContractPage = {
  async run(
    page: Page,
    options: { baseURL: string; presenterRemoteSourceRoot: string },
  ): Promise<PresenterSignalingWebRtcContractResult> {
    await presenterSignalingContractPage.gotoReady(page, options.baseURL);

    return page.evaluate(async ({ presenterRemoteSourceRoot }) => {
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
    }, { presenterRemoteSourceRoot: options.presenterRemoteSourceRoot });
  },
};
