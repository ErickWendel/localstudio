export type PresenterSignalingExpiryContractInput = {
  presenterRemoteSourceRoot: string;
};

export type PresenterSignalingExpiryContractResult = {
  activeAfterExpiryCount: number;
  lookupAfterExpiry: unknown;
};

export async function evaluatePresenterSignalingExpiryContract({
  presenterRemoteSourceRoot,
}: PresenterSignalingExpiryContractInput): Promise<PresenterSignalingExpiryContractResult> {
  const { InMemoryPresenterRemoteSignalingService } = (await import(
    `${presenterRemoteSourceRoot}/signaling-service.ts`
  )) as typeof import('../../../packages/presenter-remote/src/signaling-service');

  let now = Date.parse('2026-07-09T12:00:00.000Z');
  const service = new InMemoryPresenterRemoteSignalingService({
    now: () => now,
    randomCode: () => 'EFGH-5678',
    randomId: () => 'session-expiring',
  });
  const session = service.registerSession({
    presenterLabel: 'Expiring',
    ttlMs: 1,
  });
  now += 2;

  return {
    activeAfterExpiryCount: service.listActiveSessions().length,
    lookupAfterExpiry: service.lookupSession(session.code),
  };
}
