export type PresenterProtocolSessionChecksInput = {
  presenterRemoteSourceRoot: string;
};

export async function evaluatePresenterProtocolSessionChecks({
  presenterRemoteSourceRoot,
}: PresenterProtocolSessionChecksInput): Promise<Record<string, boolean>> {
  const { presenterRemoteProtocol } = (await import(
    `${presenterRemoteSourceRoot}/protocol.ts`
  )) as typeof import('../../../packages/presenter-remote/src/protocol');

  return {
    acceptsSession: presenterRemoteProtocol.isSession({
      code: 'ABCD-1234',
      connectedControllerCount: 1,
      expiresAt: '2026-07-10T12:01:00.000Z',
      presenterDeviceId: 'device-1',
      presenterLabel: 'Studio laptop',
      sessionId: 'session-1',
    }),
    rejectsMissingSessionId: !presenterRemoteProtocol.isSession({
      code: 'ABCD-1234',
      connectedControllerCount: 1,
      expiresAt: '2026-07-10T12:01:00.000Z',
      presenterDeviceId: 'device-1',
      presenterLabel: 'Studio laptop',
    }),
  };
}
