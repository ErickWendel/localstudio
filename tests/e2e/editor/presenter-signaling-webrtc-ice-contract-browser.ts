export type PresenterSignalingWebRtcIceContractResult = {
  controllerCandidates: Array<{ candidate: string }>;
  controllerIcePublished: boolean;
  drainedCandidates: Array<{ candidate: string }>;
  missingIce: boolean;
  presenterCandidates: Array<{ candidate: string }>;
  presenterIcePublished: boolean;
};

export async function evaluatePresenterSignalingWebRtcIceContract({
  presenterRemoteSourceRoot,
}: {
  presenterRemoteSourceRoot: string;
}): Promise<PresenterSignalingWebRtcIceContractResult> {
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
  service.createControllerOffer({
    controllerId: 'controller-1',
    offerSdp: 'offer-sdp',
    sessionCode: session.code,
  });

  const presenterIcePublished = service.publishIceCandidate(session.code, 'controller-1', {
    candidate: { candidate: 'controller-candidate' },
    target: 'presenter',
  });
  const controllerIcePublished = service.publishIceCandidate(session.code, 'controller-1', {
    candidate: { candidate: 'presenter-candidate' },
    target: 'controller',
  });
  const presenterCandidates = service.takeIceCandidates(session.code, 'controller-1', 'presenter');
  const controllerCandidates = service.takeIceCandidates(
    session.code,
    'controller-1',
    'controller',
  );
  const drainedCandidates = service.takeIceCandidates(session.code, 'controller-1', 'presenter');
  const missingIce = service.publishIceCandidate(session.code, 'missing-controller', {
    candidate: { candidate: 'missing' },
    target: 'controller',
  });

  return {
    controllerCandidates,
    controllerIcePublished,
    drainedCandidates,
    missingIce,
    presenterCandidates,
    presenterIcePublished,
  };
}
