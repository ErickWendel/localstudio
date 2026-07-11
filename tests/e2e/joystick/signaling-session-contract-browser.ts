export type JoystickSignalingSessionContractInput = {
  sourceRoot: string;
};

export type JoystickSignalingSessionContractResult = {
  afterControllerClose: unknown;
  closed: boolean;
  closedAgain: boolean;
  connected: unknown;
  controllerClosed: boolean;
  listedBeforePairing: unknown[];
  missingConnection: unknown;
  missingControllerClosed: boolean;
};

export async function evaluateJoystickSignalingSessionContract({
  sourceRoot,
}: JoystickSignalingSessionContractInput): Promise<JoystickSignalingSessionContractResult> {
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
  const listedBeforePairing = service.listSessions();
  const missingConnection = service.connectController(session.code, '');
  const connected = service.connectController(' abcd 1234 ', 'phone-1');
  const controllerClosed = service.closeController(session.code, 'phone-1');
  const afterControllerClose = service.lookupSession(session.code);
  const missingControllerClosed = service.closeController('MISSING', 'phone-1');
  const closed = service.closeSession(session.code);
  const closedAgain = service.closeSession(session.code);

  return {
    afterControllerClose,
    closed,
    closedAgain,
    connected,
    controllerClosed,
    listedBeforePairing,
    missingConnection,
    missingControllerClosed,
  };
}
