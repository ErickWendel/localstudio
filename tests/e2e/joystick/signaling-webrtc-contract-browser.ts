export type JoystickSignalingWebRtcContractInput = {
  sourceRoot: string;
};

export type JoystickSignalingWebRtcContractResult = {
  acceptedOffer: unknown;
  answer: string | undefined;
  answerAccepted: boolean;
  controllerIce: unknown[];
  controllerIceAccepted: boolean;
  drainedPresenterIce: unknown[];
  failedOffer: unknown;
  missingIceAccepted: boolean;
  pendingOffers: unknown[];
  presenterIce: unknown[];
  presenterIceAccepted: boolean;
};

export async function evaluateJoystickSignalingWebRtcContract({
  sourceRoot,
}: JoystickSignalingWebRtcContractInput): Promise<JoystickSignalingWebRtcContractResult> {
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
}
