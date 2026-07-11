import { expect, test } from '../support/journey-test';
import { presenterSignalingWebRtcContractPage } from './presenter-signaling-webrtc-contract-page';
import { serviceContractsSupport } from './service-contracts-support';

test('executes presenter signaling WebRTC exchange contracts in the browser runtime', async ({
  page,
}) => {
  const result = await presenterSignalingWebRtcContractPage.run(page, {
    baseURL: serviceContractsSupport.getServer().baseURL,
    presenterRemoteSourceRoot: serviceContractsSupport.presenterRemoteSourceRoot,
  });

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
