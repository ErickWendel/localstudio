import {
  loadPresenterPeerControlModules,
  type PresenterPeerControlContractHarnessInput,
} from './presenter-peer-control-modules';
import { createPresenterPeerControlHostPreviewBatch } from './presenter-peer-control-host-preview-batch-fixture';
import { createPresenterPeerControlHostState } from './presenter-peer-control-host-state-fixture';
import { presenterPeerControlMessagePredicates } from './presenter-peer-control-message-predicates';
import { createPresenterPeerControlReadyState } from './presenter-peer-control-ready-state-fixture';

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
  const { PresenterRemotePeerControlHost, fakePeerTransport } = await loadPresenterPeerControlModules(input);
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
  host.publishState(createPresenterPeerControlHostState());
  const hostConnection = fakePeerTransport.createDataConnection();
  hostPeer.emit('connection', hostConnection);
  hostConnection.emit('data', { command: 'request-state', type: 'command' });
  host.publishPreviewBatch(createPresenterPeerControlHostPreviewBatch());
  const throwingHostConnection = fakePeerTransport.createDataConnection();
  throwingHostConnection.throwOnSend = true;
  hostPeer.emit('connection', throwingHostConnection);
  host.publishState(createPresenterPeerControlReadyState());
  throwingHostConnection.emit('error', new Error('host connection failed'));
  const connectionRemovedAfterError = throwingHostConnection.wasClosed === false;
  host.close();

  return {
    closedConnectionCount: Number(hostConnection.wasClosed) + Number(throwingHostConnection.wasClosed),
    commandCount: commands.length,
    connectionRemovedAfterError,
    destroyedPeer: hostPeer.destroyed,
    hostClosed: hostConnection.wasClosed,
    initialStateMessages: presenterPeerControlMessagePredicates.countMessages(
      hostConnection.sentMessages,
      (message) => typeof message === 'object' && message !== null && 'type' in message,
    ),
    previewMessages: presenterPeerControlMessagePredicates.countMessages(
      hostConnection.sentMessages,
      (message) => presenterPeerControlMessagePredicates.hasType(message, 'preview-batch'),
    ),
    publishedStateMessages: presenterPeerControlMessagePredicates.countMessages(
      hostConnection.sentMessages,
      (message) => presenterPeerControlMessagePredicates.hasType(message, 'state'),
    ),
    requestedStateMessages: presenterPeerControlMessagePredicates.countMessages(
      hostConnection.sentMessages,
      (message) => presenterPeerControlMessagePredicates.hasConnectedControllerCount(message, 1),
    ),
    session,
  };
}
