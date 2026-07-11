export type JoystickProtocolContractInput = {
  sourceRoot: string;
  testSupportSourceRoot: string;
};

export type JoystickProtocolContractResult = {
  commandChecks: Record<string, boolean>;
  previewBatchChecks: Record<string, boolean>;
  sessionChecks: Record<string, boolean>;
  sessionCodeChecks: Record<string, string | boolean>;
  stateChecks: Record<string, boolean>;
  streamPreferenceChecks: Record<string, boolean>;
};

export async function evaluateJoystickProtocolContract({
  sourceRoot,
  testSupportSourceRoot,
}: JoystickProtocolContractInput): Promise<JoystickProtocolContractResult> {
  const [
    { evaluatePresenterProtocolCommandChecks },
    { evaluatePresenterProtocolPreviewBatchChecks },
    { evaluatePresenterProtocolSessionChecks },
    { evaluatePresenterProtocolSessionCodeChecks },
    { evaluatePresenterProtocolStateChecks },
    { evaluatePresenterProtocolStreamPreferenceChecks },
  ] = (await Promise.all([
    import(`${testSupportSourceRoot}/presenter-protocol-command-checks.ts`),
    import(`${testSupportSourceRoot}/presenter-protocol-preview-batch-checks.ts`),
    import(`${testSupportSourceRoot}/presenter-protocol-session-checks.ts`),
    import(`${testSupportSourceRoot}/presenter-protocol-session-code-checks.ts`),
    import(`${testSupportSourceRoot}/presenter-protocol-state-checks.ts`),
    import(`${testSupportSourceRoot}/presenter-protocol-stream-preference-checks.ts`),
  ])) as [
    typeof import('../support/presenter-protocol-command-checks'),
    typeof import('../support/presenter-protocol-preview-batch-checks'),
    typeof import('../support/presenter-protocol-session-checks'),
    typeof import('../support/presenter-protocol-session-code-checks'),
    typeof import('../support/presenter-protocol-state-checks'),
    typeof import('../support/presenter-protocol-stream-preference-checks'),
  ];
  const protocolInput = { presenterRemoteSourceRoot: sourceRoot };
  const protocolFixtureInput = { ...protocolInput, testSupportSourceRoot };

  const [
    commandChecks,
    previewBatchChecks,
    sessionChecks,
    sessionCodeChecks,
    stateChecks,
    streamPreferenceChecks,
  ] = await Promise.all([
    evaluatePresenterProtocolCommandChecks(protocolInput),
    evaluatePresenterProtocolPreviewBatchChecks(protocolFixtureInput),
    evaluatePresenterProtocolSessionChecks(protocolInput),
    evaluatePresenterProtocolSessionCodeChecks(protocolInput),
    evaluatePresenterProtocolStateChecks(protocolFixtureInput),
    evaluatePresenterProtocolStreamPreferenceChecks(protocolInput),
  ]);

  return {
    commandChecks,
    previewBatchChecks,
    sessionChecks,
    sessionCodeChecks,
    stateChecks,
    streamPreferenceChecks,
  };
}
