export type PresenterPeerOpenLifecycleInput = {
  presenterRemoteSourceRoot: string;
  timeoutMessage: string;
};

export type PresenterPeerOpenLifecycleResult = {
  peerOpenResolved: boolean;
  timeoutMessage: string;
};

export async function runPresenterPeerOpenLifecycle({
  presenterRemoteSourceRoot,
  timeoutMessage: expectedTimeoutMessage,
}: PresenterPeerOpenLifecycleInput): Promise<PresenterPeerOpenLifecycleResult> {
  const { presenterRemotePeerOpen } = (await import(
    `${presenterRemoteSourceRoot}/peer-open.ts`
  )) as typeof import('../../../packages/presenter-remote/src/peer-open');
  let timeoutMessage = '';
  try {
    await presenterRemotePeerOpen.rejectAfter(0, expectedTimeoutMessage);
  } catch (error) {
    timeoutMessage = error instanceof Error ? error.message : String(error);
  }

  return {
    peerOpenResolved:
      (await presenterRemotePeerOpen.waitForPeer({
        id: 'already-open',
        on: () => undefined,
        open: true,
      } as never)) === undefined,
    timeoutMessage,
  };
}
