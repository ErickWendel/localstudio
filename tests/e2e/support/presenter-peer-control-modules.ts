export type PresenterPeerControlContractHarnessInput = {
  presenterRemoteSourceRoot: string;
  testSupportSourceRoot: string;
};

export async function loadPresenterPeerControlModules({
  presenterRemoteSourceRoot,
  testSupportSourceRoot,
}: PresenterPeerControlContractHarnessInput) {
  const [
    { PresenterRemotePeerControlClient },
    { PresenterRemotePeerControlHost },
    { PresenterRemotePeerStreamPublisher },
    { PresenterRemotePeerStreamReceiver },
    { fakePeerTransport },
  ] = (await Promise.all([
    import(`${presenterRemoteSourceRoot}/peer-control-client.ts`),
    import(`${presenterRemoteSourceRoot}/peer-control-host.ts`),
    import(`${presenterRemoteSourceRoot}/peer-stream-publisher.ts`),
    import(`${presenterRemoteSourceRoot}/peer-stream-receiver.ts`),
    import(`${testSupportSourceRoot}/fake-peer-transport.ts`),
  ])) as [
    typeof import('../../../packages/presenter-remote/src/peer-control-client'),
    typeof import('../../../packages/presenter-remote/src/peer-control-host'),
    typeof import('../../../packages/presenter-remote/src/peer-stream-publisher'),
    typeof import('../../../packages/presenter-remote/src/peer-stream-receiver'),
    typeof import('./fake-peer-transport'),
  ];

  return {
    PresenterRemotePeerControlClient,
    PresenterRemotePeerControlHost,
    PresenterRemotePeerStreamPublisher,
    PresenterRemotePeerStreamReceiver,
    fakePeerTransport,
  };
}
