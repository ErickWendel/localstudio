export type JoystickPeerControlContractInput = {
  sourceRoot: string;
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
  protocolChecks: Record<string, boolean>;
  publishedStateMessages: number;
  receiverClearedStream: boolean;
  receiverGotStream: boolean;
  receiverStatuses: string[];
  requestedStateMessages: number;
  sessionCodeChecks: Record<string, string | boolean>;
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
}: JoystickPeerControlContractInput): Promise<JoystickPeerControlContractResult> {
  type Listener = (...args: unknown[]) => void;

  class FakeEventTarget {
    private readonly listeners = new Map<string, Listener[]>();

    emit(eventName: string, ...args: unknown[]): void {
      for (const listener of this.listeners.get(eventName) ?? []) listener(...args);
    }

    on(eventName: string, listener: Listener): void {
      const listeners = this.listeners.get(eventName) ?? [];
      listeners.push(listener);
      this.listeners.set(eventName, listeners);
    }
  }

  class FakeDataConnection extends FakeEventTarget {
    readonly sentMessages: unknown[] = [];
    open = true;
    throwOnSend = false;
    wasClosed = false;

    close(): void {
      this.wasClosed = true;
      this.emit('close');
    }

    send(message: unknown): void {
      if (this.throwOnSend) throw new Error('send failed');
      this.sentMessages.push(message);
    }
  }

  class FakeMediaConnection extends FakeEventTarget {
    answeredStream: MediaStream | undefined;
    outboundStream: MediaStream | undefined;
    wasClosed = false;

    answer(stream: MediaStream): void {
      this.answeredStream = stream;
    }

    close(): void {
      this.wasClosed = true;
      this.emit('close');
    }
  }

  class FakePeer extends FakeEventTarget {
    connectedPeerId = '';
    lastDataConnection: FakeDataConnection | undefined;
    lastMediaConnection: FakeMediaConnection | undefined;
    destroyed = false;
    open = true;

    constructor(readonly id: string) {
      super();
    }

    destroy(): void {
      this.destroyed = true;
    }

    call(peerId: string, stream: MediaStream): FakeMediaConnection {
      this.connectedPeerId = peerId;
      const call = new FakeMediaConnection();
      call.outboundStream = stream;
      this.lastMediaConnection = call;
      return call;
    }

    connect(peerId: string): FakeDataConnection {
      this.connectedPeerId = peerId;
      const connection = new FakeDataConnection();
      this.lastDataConnection = connection;
      return connection;
    }
  }

  const { PresenterRemotePeerControlClient } = (await import(
    `${sourceRoot}/peer-control-client.ts`
  )) as typeof import('../../../packages/presenter-remote/src/peer-control-client');
  const { PresenterRemotePeerControlHost } = (await import(
    `${sourceRoot}/peer-control-host.ts`
  )) as typeof import('../../../packages/presenter-remote/src/peer-control-host');
  const { presenterRemotePeerOpen } = (await import(
    `${sourceRoot}/peer-open.ts`
  )) as typeof import('../../../packages/presenter-remote/src/peer-open');
  const { PresenterRemotePeerStreamPublisher } = (await import(
    `${sourceRoot}/peer-stream-publisher.ts`
  )) as typeof import('../../../packages/presenter-remote/src/peer-stream-publisher');
  const { PresenterRemotePeerStreamReceiver } = (await import(
    `${sourceRoot}/peer-stream-receiver.ts`
  )) as typeof import('../../../packages/presenter-remote/src/peer-stream-receiver');
  const { presenterRemoteProtocol } = (await import(
    `${sourceRoot}/protocol.ts`
  )) as typeof import('../../../packages/presenter-remote/src/protocol');
  const { presenterRemoteSessionCode } = (await import(
    `${sourceRoot}/session-code.ts`
  )) as typeof import('../../../packages/presenter-remote/src/session-code');

  const commands: unknown[] = [];
  const controlPeer = new FakePeer('control-peer-1');
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

  const primaryConnection = new FakeDataConnection();
  controlPeer.emit('connection', primaryConnection);
  primaryConnection.emit('data', { command: 'request-state', type: 'command' });
  host.publishPreviewBatch({
    previews: [{ pageId: 'slide-1', preview: 'data:image/png;base64,AA==' }],
    requestId: 'preview-request-1',
    type: 'preview-batch',
  });

  const throwingConnection = new FakeDataConnection();
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

  const streamPeer = new FakePeer('stream-peer-1');
  const stream = new MediaStream();
  const publisher = new PresenterRemotePeerStreamPublisher({
    peerFactory: () => streamPeer as never,
    stream,
  });
  const streamPeerId = await publisher.start();
  const mediaCall = new FakeMediaConnection();
  streamPeer.emit('call', mediaCall);
  const answeredStreamCall = mediaCall.answeredStream === stream;
  mediaCall.emit('error', new Error('call failed'));
  const callErrored = mediaCall.wasClosed === false;
  const closingCall = new FakeMediaConnection();
  streamPeer.emit('call', closingCall);
  closingCall.close();
  publisher.stop();

  const clientPeer = new FakePeer('client-peer-1');
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

  const receiverPeer = new FakePeer('receiver-peer-1');
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

  const protocolChecks = {
    acceptsGoToPage: presenterRemoteProtocol.isCommand({
      command: 'go-to-page',
      pageId: 'slide-1',
      type: 'command',
    }),
    acceptsRequestPreviews: presenterRemoteProtocol.isCommand({
      command: 'request-previews',
      pageIds: ['slide-1'],
      requestId: 'preview-request',
      type: 'command',
    }),
    acceptsStreamPreference: presenterRemoteProtocol.isStreamPreference({
      fps: 30,
      height: 720,
      quality: 'medium',
      type: 'stream-preference',
      width: 1280,
    }),
    acceptsUpdateNotes: presenterRemoteProtocol.isCommand({
      command: 'update-notes',
      notes: 'Updated note',
      pageId: 'slide-1',
      type: 'command',
    }),
    rejectsBadPreviewElement: !presenterRemoteProtocol.isPreviewBatch({
      previews: [{ id: 'slide-1', name: 'Intro', preview: { elements: [], width: 1 } }],
      type: 'preview-batch',
    }),
    rejectsBadStreamPreference: !presenterRemoteProtocol.isStreamPreference({
      fps: 0,
      height: 0,
      quality: 'best',
      type: 'stream-preference',
      width: 0,
    }),
  };

  const sessionCodeChecks = {
    createdFallback: presenterRemoteSessionCode.create(() => 2).endsWith('AAAA'),
    normalizedShort: presenterRemoteSessionCode.normalize('ab 12'),
    normalizedSpaced: presenterRemoteSessionCode.normalize('ab12 cd34'),
    rejectsInvalid: presenterRemoteSessionCode.isValid('IOOO-0000') === false,
    validatesNormalized: presenterRemoteSessionCode.isValid('ab12 cd34'),
  };

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
    protocolChecks,
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
    sessionCodeChecks,
    session,
    streamPeerId,
    timeoutMessage,
  };
}
