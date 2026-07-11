export type PresenterPeerTransportContractInput = {
  presenterRemoteSourceRoot: string;
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

type Listener = (...args: unknown[]) => void;

export async function evaluatePresenterPeerTransportContract({
  presenterRemoteSourceRoot,
}: PresenterPeerTransportContractInput): Promise<PresenterPeerTransportContractResult> {
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
    open = true;
    sentMessages: unknown[] = [];
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
    destroyed = false;
    lastDataConnection: FakeDataConnection | undefined;
    lastMediaConnection: FakeMediaConnection | undefined;
    open = true;

    constructor(readonly id: string) {
      super();
    }

    call(): FakeMediaConnection {
      const call = new FakeMediaConnection();
      this.lastMediaConnection = call;
      return call;
    }

    connect(): FakeDataConnection {
      const connection = new FakeDataConnection();
      this.lastDataConnection = connection;
      return connection;
    }

    destroy(): void {
      this.destroyed = true;
    }
  }

  const [
    { PresenterRemotePeerControlClient },
    { PresenterRemotePeerControlHost },
    { presenterRemotePeerOpen },
    { PresenterRemotePeerStreamPublisher },
    { PresenterRemotePeerStreamReceiver },
  ] = (await Promise.all([
    import(`${presenterRemoteSourceRoot}/peer-control-client.ts`),
    import(`${presenterRemoteSourceRoot}/peer-control-host.ts`),
    import(`${presenterRemoteSourceRoot}/peer-open.ts`),
    import(`${presenterRemoteSourceRoot}/peer-stream-publisher.ts`),
    import(`${presenterRemoteSourceRoot}/peer-stream-receiver.ts`),
  ])) as [
    typeof import('../../../packages/presenter-remote/src/peer-control-client'),
    typeof import('../../../packages/presenter-remote/src/peer-control-host'),
    typeof import('../../../packages/presenter-remote/src/peer-open'),
    typeof import('../../../packages/presenter-remote/src/peer-stream-publisher'),
    typeof import('../../../packages/presenter-remote/src/peer-stream-receiver'),
  ];

  const commands: unknown[] = [];
  const hostPeer = new FakePeer('host-peer');
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
  host.publishState({
    activePageId: 'slide-1',
    activePageIndex: 0,
    buildsRemaining: 0,
    connectedControllerCount: 0,
    deckName: 'Transport contract',
    notes: '',
    pageCount: 1,
    presenterMode: 'presenting',
    shortcuts: [],
    timer: { elapsedMs: 0, paused: true },
    type: 'state',
  });
  const hostConnection = new FakeDataConnection();
  hostPeer.emit('connection', hostConnection);
  hostConnection.emit('data', { command: 'request-state', type: 'command' });
  host.publishPreviewBatch({
    previews: [{ id: 'slide-1', name: 'Intro' }],
    requestId: 'preview-request',
    type: 'preview-batch',
  });
  const throwingHostConnection = new FakeDataConnection();
  throwingHostConnection.throwOnSend = true;
  hostPeer.emit('connection', throwingHostConnection);
  host.publishState({
    activePageId: 'slide-2',
    activePageIndex: 1,
    buildsRemaining: 0,
    connectedControllerCount: 0,
    deckName: 'Transport contract',
    notes: '',
    pageCount: 2,
    presenterMode: 'ready',
    shortcuts: [],
    timer: { elapsedMs: 100, paused: false },
    type: 'state',
  });
  throwingHostConnection.emit('error', new Error('host connection failed'));
  host.close();

  const clientPeer = new FakePeer('client-peer');
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
  clientConnection?.emit('data', {
    previews: [{ id: 'slide-1', name: 'Intro' }],
    requestId: 'preview-request',
    type: 'preview-batch',
  });
  clientConnection?.emit('data', {
    activePageId: 'slide-1',
    activePageIndex: 0,
    buildsRemaining: 0,
    connectedControllerCount: 1,
    deckName: 'Transport contract',
    notes: '',
    pageCount: 1,
    presenterMode: 'ready',
    shortcuts: [],
    timer: { elapsedMs: 0, paused: true },
    type: 'state',
  });
  clientConnection?.emit('data', { type: 'ignored' });
  const sentCommandSucceeded = client.sendCommand({ command: 'next', type: 'command' });
  if (clientConnection) clientConnection.throwOnSend = true;
  const sentCommandFailed = !client.sendCommand({ command: 'previous', type: 'command' });
  clientConnection?.emit('error', new Error('client connection failed'));
  client.close();

  const stream = new MediaStream();
  const publisherPeer = new FakePeer('publisher-peer');
  const publisher = new PresenterRemotePeerStreamPublisher({
    peerFactory: () => publisherPeer as never,
    stream,
  });
  const streamPeerId = await publisher.start();
  const publisherCall = new FakeMediaConnection();
  publisherPeer.emit('call', publisherCall);
  publisherCall.emit('close');
  publisher.stop();

  const receiverPeer = new FakePeer('receiver-peer');
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
      clientConnection?.sentMessages.some(
        (message) =>
          typeof message === 'object' &&
          message !== null &&
          'command' in message &&
          message.command === 'request-state',
      ) ?? false,
    sentCommandFailed,
    sentCommandSucceeded,
    stateCount: states.length,
    streamPeerId,
    timeoutMessage,
  };
}
