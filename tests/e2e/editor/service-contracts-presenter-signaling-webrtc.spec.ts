import { expect, test } from '../support/journey-test';
import { presenterSignalingWebRtcContractPage } from './presenter-signaling-webrtc-contract-page';
import { serviceContractsSupport } from './service-contracts-support';

test('executes presenter signaling WebRTC offer contracts in the browser runtime', async ({
  page,
}) => {
  const result = await presenterSignalingWebRtcContractPage.runOffer(page, {
    baseURL: serviceContractsSupport.getServer().baseURL,
    presenterRemoteSourceRoot: serviceContractsSupport.presenterRemoteSourceRoot,
  });

  expect(result).toMatchObject({
    missingOffer: { status: 'not-found' },
    trustedOffer: { status: 'pending' },
    untrustedOffer: { status: 'not-found' },
  });
  expect(result.pendingOffers).toEqual([{ controllerId: 'controller-1', offerSdp: 'offer-sdp' }]);
});

test('executes presenter signaling WebRTC answer contracts in the browser runtime', async ({
  page,
}) => {
  const result = await presenterSignalingWebRtcContractPage.runAnswer(page, {
    baseURL: serviceContractsSupport.getServer().baseURL,
    presenterRemoteSourceRoot: serviceContractsSupport.presenterRemoteSourceRoot,
  });

  expect(result).toMatchObject({
    answer: 'answer-sdp',
    answerPublished: true,
    missingAnswerPublished: false,
  });
});

test('executes presenter signaling WebRTC ICE contracts in the browser runtime', async ({
  page,
}) => {
  const result = await presenterSignalingWebRtcContractPage.runIce(page, {
    baseURL: serviceContractsSupport.getServer().baseURL,
    presenterRemoteSourceRoot: serviceContractsSupport.presenterRemoteSourceRoot,
  });

  expect(result).toMatchObject({
    controllerIcePublished: true,
    drainedCandidates: [],
    missingIce: false,
    presenterIcePublished: true,
  });
  expect(result.controllerCandidates).toEqual([{ candidate: 'presenter-candidate' }]);
  expect(result.presenterCandidates).toEqual([{ candidate: 'controller-candidate' }]);
});
