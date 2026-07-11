export type PresenterPeerTransportContractInput = {
  presenterRemoteSourceRoot: string;
  testSupportSourceRoot: string;
};

export type PresenterPeerTransportContractResult = {
  clientStatuses: string[];
  commandCount: number;
  destroyedPeerCount: number;
  hostClosed: boolean;
  hostOpenCount: number;
  previewBatchCount: number;
  publisherAnsweredCall: boolean;
  receiverStatuses: string[];
  requestStateSent: boolean;
  sentCommandFailed: boolean;
  sentCommandSucceeded: boolean;
  stateCount: number;
  streamPeerId: string;
  timeoutMessage: string;
};

export async function evaluatePresenterPeerTransportContract({
  presenterRemoteSourceRoot,
  testSupportSourceRoot,
}: PresenterPeerTransportContractInput): Promise<PresenterPeerTransportContractResult> {
  const [
    { PresenterRemotePeerControlClient },
    { PresenterRemotePeerControlHost },
    { presenterRemotePeerOpen },
    { PresenterRemotePeerStreamPublisher },
    { PresenterRemotePeerStreamReceiver },
    { fakePeerTransport },
    { presenterPeerControlFixture },
  ] = (await Promise.all([
    import(`${presenterRemoteSourceRoot}/peer-control-client.ts`),
    import(`${presenterRemoteSourceRoot}/peer-control-host.ts`),
    import(`${presenterRemoteSourceRoot}/peer-open.ts`),
    import(`${presenterRemoteSourceRoot}/peer-stream-publisher.ts`),
    import(`${presenterRemoteSourceRoot}/peer-stream-receiver.ts`),
    import(`${testSupportSourceRoot}/fake-peer-transport.ts`),
    import(`${testSupportSourceRoot}/presenter-peer-control-fixture.ts`),
  ])) as [
    typeof import('../../../packages/presenter-remote/src/peer-control-client'),
    typeof import('../../../packages/presenter-remote/src/peer-control-host'),
    typeof import('../../../packages/presenter-remote/src/peer-open'),
    typeof import('../../../packages/presenter-remote/src/peer-stream-publisher'),
    typeof import('../../../packages/presenter-remote/src/peer-stream-receiver'),
    typeof import('../support/fake-peer-transport'),
    typeof import('../support/presenter-peer-control-fixture'),
  ];

  const commands: unknown[] = [];
  const hostPeer = fakePeerTransport.createPeer('host-peer');
  const host = new PresenterRemotePeerControlHost({
    now: () => Date.parse('2026-07-10T12:00:00.000Z'),
    onCommand: (command) => commands.push(command),
    peerFactory: () => hostPeer as never,
    presenterDeviceId: 'presenter-device',
    presenterLabel: 'Studio laptop',
    ttlMs: 60_000,
  });
  await host.open();
  const hostOpenCount = await host.open().then(() => 1);
  host.publishState(presenterPeerControlFixture.createHostState());
  const hostConnection = fakePeerTransport.createDataConnection();
  hostPeer.emit('connection', hostConnection);
  hostConnection.emit('data', { command: 'request-state', type: 'command' });
  host.publishPreviewBatch(presenterPeerControlFixture.createHostPreviewBatch());
  const throwingHostConnection = fakePeerTransport.createDataConnection();
  throwingHostConnection.throwOnSend = true;
  hostPeer.emit('connection', throwingHostConnection);
  host.publishState(presenterPeerControlFixture.createReadyState());
  throwingHostConnection.emit('error', new Error('host connection failed'));
  host.close();

  const clientPeer = fakePeerTransport.createPeer('client-peer');
  const clientStatuses: string[] = [];
  const states: unknown[] = [];
  const previewBatches: unknown[] = [];
  const client = new PresenterRemotePeerControlClient({
    onPreviewBatch: (batch) => previewBatches.push(batch),
    onState: (state) => states.push(state),
    onStatusChange: (status) => clientStatuses.push(status),
    peerFactory: () => clientPeer as never,
    presenterPeerId: 'host-peer',
  });
  await client.start();
  const clientConnection = clientPeer.lastDataConnection;
  clientConnection?.emit('data', presenterPeerControlFixture.createClientPreviewBatch());
  clientConnection?.emit('data', presenterPeerControlFixture.createClientState());
  clientConnection?.emit('data', { type: 'ignored' });
  const sentCommandSucceeded = client.sendCommand({ command: 'next', type: 'command' });
  if (clientConnection) clientConnection.throwOnSend = true;
  const sentCommandFailed = !client.sendCommand({ command: 'previous', type: 'command' });
  clientConnection?.emit('error', new Error('client connection failed'));
  client.close();

  const stream = new MediaStream();
  const publisherPeer = fakePeerTransport.createPeer('publisher-peer');
  const publisher = new PresenterRemotePeerStreamPublisher({
    peerFactory: () => publisherPeer as never,
    stream,
  });
  const streamPeerId = await publisher.start();
  const publisherCall = fakePeerTransport.createMediaConnection();
  publisherPeer.emit('call', publisherCall);
  publisherCall.emit('close');
  publisher.stop();

  const receiverPeer = fakePeerTransport.createPeer('receiver-peer');
  const receiverStatuses: string[] = [];
  const receiver = new PresenterRemotePeerStreamReceiver({
    onStatusChange: (status) => receiverStatuses.push(status),
    onStream: () => undefined,
    peerFactory: () => receiverPeer as never,
    streamPeerId,
  });
  await receiver.start();
  receiverPeer.lastMediaConnection?.emit('stream', stream);
  receiverPeer.lastMediaConnection?.emit('close');
  receiver.stop();

  let timeoutMessage = '';
  try {
    await presenterRemotePeerOpen.rejectAfter(0, 'transport timeout');
  } catch (error) {
    timeoutMessage = error instanceof Error ? error.message : String(error);
  }

  return {
    clientStatuses,
    commandCount: commands.length,
    destroyedPeerCount:
      Number(hostPeer.destroyed) +
      Number(clientPeer.destroyed) +
      Number(publisherPeer.destroyed) +
      Number(receiverPeer.destroyed),
    hostClosed: hostConnection.wasClosed,
    hostOpenCount,
    previewBatchCount: previewBatches.length,
    publisherAnsweredCall: publisherCall.answeredStream === stream,
    receiverStatuses,
    requestStateSent:
      clientConnection?.sentMessages.some((message) =>
        presenterPeerControlFixture.hasCommand(message, 'request-state'),
      ) ?? false,
    sentCommandFailed,
    sentCommandSucceeded,
    stateCount: states.length,
    streamPeerId,
    timeoutMessage,
  };
}
