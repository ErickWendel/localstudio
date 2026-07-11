export type JoystickSignalingExpiryContractInput = {
  sourceRoot: string;
};

export type JoystickSignalingExpiryContractResult = {
  expiredLookup: unknown;
};

export async function evaluateJoystickSignalingExpiryContract({
  sourceRoot,
}: JoystickSignalingExpiryContractInput): Promise<JoystickSignalingExpiryContractResult> {
  const { InMemoryPresenterRemoteSignalingService } = (await import(
    `${sourceRoot}/signaling-service.ts`
  )) as typeof import('../../../packages/presenter-remote/src/signaling-service');

  let now = Date.parse('2026-07-10T12:00:00.000Z');
  const service = new InMemoryPresenterRemoteSignalingService({
    now: () => now,
    randomCode: () => 'EFGH-5678',
    randomId: () => 'session-expiring',
  });
  const session = service.registerSession({
    presenterLabel: 'Temporary presenter',
    ttlMs: 1,
  });
  now += 2;

  return {
    expiredLookup: service.lookupSession(session.code),
  };
}
