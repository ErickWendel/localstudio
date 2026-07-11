export type PresenterOptionsContractInput = {
  presenterRemoteSourceRoot: string;
};

export type PresenterOptionsContractResult = {
  missingPeerOptions: unknown;
  peerOptions: unknown;
  timers: string[];
};

export async function evaluatePresenterOptionsContract({
  presenterRemoteSourceRoot,
}: PresenterOptionsContractInput): Promise<PresenterOptionsContractResult> {
  const [{ getRuntimePeerOptions }, { presenterRemoteTimerFormat }] = (await Promise.all([
    import(`${presenterRemoteSourceRoot}/peer-options.ts`),
    import(`${presenterRemoteSourceRoot}/timer-format.ts`),
  ])) as [
    typeof import('../../../packages/presenter-remote/src/peer-options'),
    typeof import('../../../packages/presenter-remote/src/timer-format'),
  ];

  globalThis.__LOCALSTUDIO_PEERJS_OPTIONS__ = {
    host: 'localhost',
    path: '/peerjs',
    port: 9000,
    secure: false,
  };
  const peerOptions = getRuntimePeerOptions();
  globalThis.__LOCALSTUDIO_PEERJS_OPTIONS__ = { host: '', port: 0 };
  const missingPeerOptions = getRuntimePeerOptions();

  return {
    missingPeerOptions,
    peerOptions,
    timers: [
      presenterRemoteTimerFormat.formatElapsed(-1),
      presenterRemoteTimerFormat.formatElapsed(65_000),
      presenterRemoteTimerFormat.formatElapsed(3_661_000),
    ],
  };
}
