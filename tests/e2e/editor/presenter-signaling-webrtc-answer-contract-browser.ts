export type PresenterSignalingWebRtcAnswerContractResult = {
  answer: string | null;
  answerPublished: boolean;
  missingAnswerPublished: boolean;
};

export async function evaluatePresenterSignalingWebRtcAnswerContract({
  presenterRemoteSourceRoot,
}: {
  presenterRemoteSourceRoot: string;
}): Promise<PresenterSignalingWebRtcAnswerContractResult> {
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

  const missingAnswerPublished = service.publishAnswer(session.code, 'controller-2', 'answer-sdp');
  const answerPublished = service.publishAnswer(session.code, 'controller-1', 'answer-sdp');
  const answer = service.getAnswer(session.code, 'controller-1');

  return {
    answer,
    answerPublished,
    missingAnswerPublished,
  };
}
