import {
  loadPresenterPeerControlModules,
  type PresenterPeerControlContractHarnessInput,
} from './presenter-peer-control-modules';

export type PresenterPeerControlHostLifecycleInput = PresenterPeerControlContractHarnessInput & {
  peerId: string;
  presenterDeviceId: string;
  presenterLabel: string;
};

export type PresenterPeerControlHostLifecycleResult = {
  closedConnectionCount: number;
  commandCount: number;
  connectionRemovedAfterError: boolean;
  destroyedPeer: boolean;
  hostClosed: boolean;
  initialStateMessages: number;
  previewMessages: number;
  publishedStateMessages: number;
  requestedStateMessages: number;
  session: {
    code: string;
    connectedControllerCount: number;
    controlPeerId: string;
    presenterDeviceId: string;
    presenterLabel: string;
    transport: string;
  };
};

export async function runPresenterPeerControlHostLifecycle({
  peerId,
  presenterDeviceId,
  presenterLabel,
  ...input
}: PresenterPeerControlHostLifecycleInput): Promise<PresenterPeerControlHostLifecycleResult> {
  const { PresenterRemotePeerControlHost, fakePeerTransport, presenterPeerControlFixture } =
    await loadPresenterPeerControlModules(input);
  const commands: unknown[] = [];
  const hostPeer = fakePeerTransport.createPeer(peerId);
  const host = new PresenterRemotePeerControlHost({
    now: () => Date.parse('2026-07-10T12:00:00.000Z'),
    onCommand: (command) => commands.push(command),
    peerFactory: () => hostPeer as never,
    presenterDeviceId,
    presenterLabel,
    ttlMs: 60_000,
  });

  const session = await host.open();
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
  const connectionRemovedAfterError = throwingHostConnection.wasClosed === false;
  host.close();

  return {
    closedConnectionCount: Number(hostConnection.wasClosed) + Number(throwingHostConnection.wasClosed),
    commandCount: commands.length,
    connectionRemovedAfterError,
    destroyedPeer: hostPeer.destroyed,
    hostClosed: hostConnection.wasClosed,
    initialStateMessages: presenterPeerControlFixture.countMessages(
      hostConnection.sentMessages,
      (message) => typeof message === 'object' && message !== null && 'type' in message,
    ),
    previewMessages: presenterPeerControlFixture.countMessages(
      hostConnection.sentMessages,
      (message) => presenterPeerControlFixture.hasType(message, 'preview-batch'),
    ),
    publishedStateMessages: presenterPeerControlFixture.countMessages(
      hostConnection.sentMessages,
      (message) => presenterPeerControlFixture.hasType(message, 'state'),
    ),
    requestedStateMessages: presenterPeerControlFixture.countMessages(
      hostConnection.sentMessages,
      (message) => presenterPeerControlFixture.hasConnectedControllerCount(message, 1),
    ),
    session,
  };
}
