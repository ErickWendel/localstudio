export type PresenterProtocolSessionCodeChecksInput = {
  presenterRemoteSourceRoot: string;
};

export async function evaluatePresenterProtocolSessionCodeChecks({
  presenterRemoteSourceRoot,
}: PresenterProtocolSessionCodeChecksInput): Promise<Record<string, string | boolean>> {
  const { presenterRemoteSessionCode } = (await import(
    `${presenterRemoteSourceRoot}/session-code.ts`
  )) as typeof import('../../../packages/presenter-remote/src/session-code');

  return {
    createdFallback: presenterRemoteSessionCode.create(() => 2).endsWith('AAAA'),
    normalizedShort: presenterRemoteSessionCode.normalize('ab 12'),
    normalizedSpaced: presenterRemoteSessionCode.normalize('ab12 cd34'),
    rejectsInvalid: presenterRemoteSessionCode.isValid('IOOO-0000') === false,
    validatesNormalized: presenterRemoteSessionCode.isValid('ab12 cd34'),
  };
}
