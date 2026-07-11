export type PresenterSignalingWebRtcOfferContractResult = {
  missingOffer: { status: string };
  pendingOffers: Array<{ controllerId: string; offerSdp: string }>;
  trustedOffer: { status: string };
  untrustedOffer: { status: string };
};

export async function evaluatePresenterSignalingWebRtcOfferContract({
  presenterRemoteSourceRoot,
}: {
  presenterRemoteSourceRoot: string;
}): Promise<PresenterSignalingWebRtcOfferContractResult> {
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

  return {
    missingOffer,
    pendingOffers,
    trustedOffer,
    untrustedOffer,
  };
}
