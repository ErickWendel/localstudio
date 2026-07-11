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
  ] = (await Promise.all([
    import(`${sourceRoot}/peer-control-client.ts`),
    import(`${sourceRoot}/peer-control-host.ts`),
    import(`${sourceRoot}/peer-open.ts`),
    import(`${sourceRoot}/peer-stream-publisher.ts`),
    import(`${sourceRoot}/peer-stream-receiver.ts`),
    import(`${testSupportSourceRoot}/fake-peer-transport.ts`),
  ])) as [
    typeof import('../../../packages/presenter-remote/src/peer-control-client'),
    typeof import('../../../packages/presenter-remote/src/peer-control-host'),
    typeof import('../../../packages/presenter-remote/src/peer-open'),
    typeof import('../../../packages/presenter-remote/src/peer-stream-publisher'),
    typeof import('../../../packages/presenter-remote/src/peer-stream-receiver'),
    typeof import('../support/fake-peer-transport'),
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
  host.publishState({
    activePageId: 'slide-1',
    activePageIndex: 0,
    buildsRemaining: 1,
    canGoNext: true,
    canGoPrevious: false,
    connectedControllerCount: 0,
    currentSlideIndex: 0,
    deckName: 'Peer contract',
    notes: 'Speaker note',
    pageCount: 2,
    pages: [{ id: 'slide-1', index: 0, title: 'Intro' }],
    presenterMode: 'presenting',
    shortcuts: ['Swipe to navigate'],
    slideCount: 2,
    slidePreview: { pageId: 'slide-1', preview: 'data:image/png;base64,AA==' },
    slideTitle: 'Intro',
    stream: { peerId: 'stream-peer-1', status: 'available' },
    timer: { elapsedMs: 1_000, paused: false },
    timerElapsedMs: 1_000,
    timerRunning: true,
    type: 'state',
  });

  const primaryConnection = fakePeerTransport.createDataConnection();
  controlPeer.emit('connection', primaryConnection);
  primaryConnection.emit('data', { command: 'request-state', type: 'command' });
  host.publishPreviewBatch({
    previews: [{ pageId: 'slide-1', preview: 'data:image/png;base64,AA==' }],
    requestId: 'preview-request-1',
    type: 'preview-batch',
  });

  const throwingConnection = fakePeerTransport.createDataConnection();
  throwingConnection.throwOnSend = true;
  controlPeer.emit('connection', throwingConnection);
  host.publishState({
    activePageId: 'slide-2',
    activePageIndex: 1,
    buildsRemaining: 0,
    canGoNext: false,
    canGoPrevious: true,
    connectedControllerCount: 0,
    currentSlideIndex: 1,
    deckName: 'Peer contract',
    notes: '',
    pageCount: 2,
    presenterMode: 'presenting',
    shortcuts: [],
    slideCount: 2,
    slideTitle: 'Close',
    timer: { elapsedMs: 2_000, paused: true },
    timerElapsedMs: 2_000,
    timerRunning: false,
    type: 'state',
  });
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
    clientConnection?.sentMessages.some(
      (message) =>
        typeof message === 'object' &&
        message !== null &&
        'command' in message &&
        message.command === 'request-state',
    ) ?? false;
  clientConnection?.emit('data', {
    previews: [{ id: 'slide-1', name: 'Intro' }],
    requestId: 'client-preview-request',
    type: 'preview-batch',
  });
  clientConnection?.emit('data', {
    activePageId: 'slide-1',
    activePageIndex: 0,
    buildsRemaining: 0,
    connectedControllerCount: 1,
    deckName: 'Client state',
    notes: '',
    pageCount: 1,
    presenterMode: 'ready',
    shortcuts: [],
    timer: { elapsedMs: 0, paused: true },
    type: 'state',
  });
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
    initialStateMessages: primaryConnection.sentMessages.filter(
      (message) => typeof message === 'object' && message !== null && 'type' in message,
    ).length,
    peerOpenResolved,
    previewMessages: primaryConnection.sentMessages.filter(
      (message) =>
        typeof message === 'object' &&
        message !== null &&
        'type' in message &&
        message.type === 'preview-batch',
    ).length,
    publishedStateMessages: primaryConnection.sentMessages.filter(
      (message) =>
        typeof message === 'object' &&
        message !== null &&
        'type' in message &&
        message.type === 'state',
    ).length,
    receiverClearedStream: receiverStreams.at(-1) === undefined,
    receiverGotStream: receiverStreams.includes(receivedStream),
    receiverStatuses,
    requestedStateMessages: primaryConnection.sentMessages.filter(
      (message) =>
        typeof message === 'object' &&
        message !== null &&
        'type' in message &&
        message.type === 'state' &&
        'connectedControllerCount' in message &&
        message.connectedControllerCount === 1,
    ).length,
    session,
    streamPeerId,
    timeoutMessage,
  };
}
