export type JoystickPeerControlContractInput = {
  sourceRoot: string;
  testSupportSourceRoot: string;
};

export type JoystickPeerControlContractResult = {
  answeredStreamCall: boolean;
  callClosed: boolean;
  callErrored: boolean;
  clientCommandFailed: boolean;
  clientCommandSent: boolean;
  clientPreviewBatchCount: number;
  clientRequestStateSent: boolean;
  clientStateCount: number;
  clientStatuses: string[];
  closedConnectionCount: number;
  commandCount: number;
  connectionRemovedAfterError: boolean;
  destroyedPeerCount: number;
  initialStateMessages: number;
  peerOpenResolved: boolean;
  previewMessages: number;
  publishedStateMessages: number;
  receiverClearedStream: boolean;
  receiverGotStream: boolean;
  receiverStatuses: string[];
  requestedStateMessages: number;
  session: {
    code: string;
    connectedControllerCount: number;
    controlPeerId: string;
    presenterDeviceId: string;
    presenterLabel: string;
    transport: string;
  };
  streamPeerId: string;
  timeoutMessage: string;
};

export async function evaluateJoystickPeerControlContract({
  sourceRoot,
  testSupportSourceRoot,
}: JoystickPeerControlContractInput): Promise<JoystickPeerControlContractResult> {
  const [
    { PresenterRemotePeerControlClient },
    { PresenterRemotePeerControlHost },
    { presenterRemotePeerOpen },
    { PresenterRemotePeerStreamPublisher },
    { PresenterRemotePeerStreamReceiver },
    { fakePeerTransport },
    { presenterPeerControlFixture },
  ] = (await Promise.all([
    import(`${sourceRoot}/peer-control-client.ts`),
    import(`${sourceRoot}/peer-control-host.ts`),
    import(`${sourceRoot}/peer-open.ts`),
    import(`${sourceRoot}/peer-stream-publisher.ts`),
    import(`${sourceRoot}/peer-stream-receiver.ts`),
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
  const controlPeer = fakePeerTransport.createPeer('control-peer-1');
  const host = new PresenterRemotePeerControlHost({
    now: () => Date.parse('2026-07-10T12:00:00.000Z'),
    onCommand: (command) => commands.push(command),
    peerFactory: () => controlPeer as never,
    presenterDeviceId: 'presenter-device-1',
    presenterLabel: 'Studio laptop',
    ttlMs: 60_000,
  });

  const session = await host.open();
  host.publishState(presenterPeerControlFixture.createHostState());

  const primaryConnection = fakePeerTransport.createDataConnection();
  controlPeer.emit('connection', primaryConnection);
  primaryConnection.emit('data', { command: 'request-state', type: 'command' });
  host.publishPreviewBatch(presenterPeerControlFixture.createHostPreviewBatch());

  const throwingConnection = fakePeerTransport.createDataConnection();
  throwingConnection.throwOnSend = true;
  controlPeer.emit('connection', throwingConnection);
  host.publishState(presenterPeerControlFixture.createReadyState());
  throwingConnection.emit('error', new Error('connection failed'));
  const connectionRemovedAfterError = throwingConnection.wasClosed === false;
  host.close();

  const streamPeer = fakePeerTransport.createPeer('stream-peer-1');
  const stream = new MediaStream();
  const publisher = new PresenterRemotePeerStreamPublisher({
    peerFactory: () => streamPeer as never,
    stream,
  });
  const streamPeerId = await publisher.start();
  const mediaCall = fakePeerTransport.createMediaConnection();
  streamPeer.emit('call', mediaCall);
  const answeredStreamCall = mediaCall.answeredStream === stream;
  mediaCall.emit('error', new Error('call failed'));
  const callErrored = mediaCall.wasClosed === false;
  const closingCall = fakePeerTransport.createMediaConnection();
  streamPeer.emit('call', closingCall);
  closingCall.close();
  publisher.stop();

  const clientPeer = fakePeerTransport.createPeer('client-peer-1');
  const clientStatuses: string[] = [];
  const clientStates: unknown[] = [];
  const clientPreviewBatches: unknown[] = [];
  const client = new PresenterRemotePeerControlClient({
    onPreviewBatch: (batch) => clientPreviewBatches.push(batch),
    onState: (state) => clientStates.push(state),
    onStatusChange: (status) => clientStatuses.push(status),
    peerFactory: () => clientPeer as never,
    presenterPeerId: 'control-peer-1',
  });
  await client.start();
  const clientConnection = clientPeer.lastDataConnection;
  const clientRequestStateSent =
    clientConnection?.sentMessages.some((message) =>
      presenterPeerControlFixture.hasCommand(message, 'request-state'),
    ) ?? false;
  clientConnection?.emit('data', presenterPeerControlFixture.createClientPreviewBatch());
  clientConnection?.emit('data', presenterPeerControlFixture.createClientState());
  clientConnection?.emit('data', { type: 'ignored' });
  const clientCommandSent = client.sendCommand({ command: 'next', type: 'command' });
  if (clientConnection) clientConnection.throwOnSend = true;
  const clientCommandFailed = !client.sendCommand({ command: 'previous', type: 'command' });
  clientConnection?.emit('close');
  client.close();

  const receiverPeer = fakePeerTransport.createPeer('receiver-peer-1');
  const receiverStatuses: string[] = [];
  const receiverStreams: Array<MediaStream | undefined> = [];
  const receiver = new PresenterRemotePeerStreamReceiver({
    onStatusChange: (status) => receiverStatuses.push(status),
    onStream: (receivedStream) => receiverStreams.push(receivedStream),
    peerFactory: () => receiverPeer as never,
    streamPeerId: 'stream-peer-1',
  });
  await receiver.start();
  const receivedStream = new MediaStream();
  receiverPeer.lastMediaConnection?.emit('stream', receivedStream);
  receiverPeer.lastMediaConnection?.emit('error', new Error('receiver call failed'));
  receiverPeer.lastMediaConnection?.emit('close');
  receiver.stop();

  let timeoutMessage = '';
  try {
    await presenterRemotePeerOpen.rejectAfter(0, 'expected timeout');
  } catch (error) {
    timeoutMessage = error instanceof Error ? error.message : String(error);
  }
  const peerOpenResolved = (await presenterRemotePeerOpen.waitForPeer({
    id: 'already-open',
    on: () => undefined,
    open: true,
  } as never)) === undefined;

  return {
    answeredStreamCall,
    callClosed: closingCall.wasClosed,
    callErrored,
    clientCommandFailed,
    clientCommandSent,
    clientPreviewBatchCount: clientPreviewBatches.length,
    clientRequestStateSent,
    clientStateCount: clientStates.length,
    clientStatuses,
    closedConnectionCount: Number(primaryConnection.wasClosed) + Number(throwingConnection.wasClosed),
    commandCount: commands.length,
    connectionRemovedAfterError,
    destroyedPeerCount: Number(controlPeer.destroyed) + Number(streamPeer.destroyed),
    initialStateMessages: presenterPeerControlFixture.countMessages(
      primaryConnection.sentMessages,
      (message) => typeof message === 'object' && message !== null && 'type' in message,
    ),
    peerOpenResolved,
    previewMessages: presenterPeerControlFixture.countMessages(
      primaryConnection.sentMessages,
      (message) => presenterPeerControlFixture.hasType(message, 'preview-batch'),
    ),
    publishedStateMessages: presenterPeerControlFixture.countMessages(
      primaryConnection.sentMessages,
      (message) => presenterPeerControlFixture.hasType(message, 'state'),
    ),
    receiverClearedStream: receiverStreams.at(-1) === undefined,
    receiverGotStream: receiverStreams.includes(receivedStream),
    receiverStatuses,
    requestedStateMessages: presenterPeerControlFixture.countMessages(
      primaryConnection.sentMessages,
      (message) => presenterPeerControlFixture.hasConnectedControllerCount(message, 1),
    ),
    session,
    streamPeerId,
    timeoutMessage,
  };
}
