export type PresenterSignalingSessionContractInput = {
  presenterRemoteSourceRoot: string;
};

export type PresenterSignalingSessionContractResult = {
  connectedCount: number | undefined;
  controllerClosed: boolean;
  lookupCode: string | undefined;
  missingConnection: unknown;
  missingControllerClosed: boolean;
  sessionAfterControllerClose: unknown;
  sessionClosed: boolean;
  sessionClosedAgain: boolean;
  singleActiveCode: string | undefined;
};

export async function evaluatePresenterSignalingSessionContract({
  presenterRemoteSourceRoot,
}: PresenterSignalingSessionContractInput): Promise<PresenterSignalingSessionContractResult> {
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
  const connected = service.connectController(' abcd 1234 ', 'controller-1');
  const missingConnection = service.connectController(session.code, '');
  const lookupCode = service.lookupSession('abcd1234')?.code;
  const singleActiveCode = service.getSingleActiveSession()?.code;
  const controllerClosed = service.closeController(session.code, 'controller-1');
  const sessionAfterControllerClose = service.lookupSession(session.code);
  const missingControllerClosed = service.closeController('000000', 'controller-1');
  const sessionClosed = service.closeSession(session.code);
  const sessionClosedAgain = service.closeSession(session.code);

  return {
    connectedCount: connected?.connectedControllerCount,
    controllerClosed,
    lookupCode,
    missingConnection,
    missingControllerClosed,
    sessionAfterControllerClose,
    sessionClosed,
    sessionClosedAgain,
    singleActiveCode,
  };
}
