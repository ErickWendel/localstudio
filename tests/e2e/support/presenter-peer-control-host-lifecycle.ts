import {
  loadPresenterPeerControlModules,
  type PresenterPeerControlContractHarnessInput,
} from './presenter-peer-control-modules';
import { createPresenterPeerControlHostPreviewBatch } from './presenter-peer-control-host-preview-batch-fixture';
import { createPresenterPeerControlHostState } from './presenter-peer-control-host-state-fixture';
import {
  createPresenterPeerControlHostLifecycleResult,
  type PresenterPeerControlHostLifecycleResult,
} from './presenter-peer-control-host-lifecycle-result';
import { createPresenterPeerControlReadyState } from './presenter-peer-control-ready-state-fixture';

export type PresenterPeerControlHostLifecycleInput = PresenterPeerControlContractHarnessInput & {
  peerId: string;
  presenterDeviceId: string;
  presenterLabel: string;
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

  return createPresenterPeerControlHostLifecycleResult({
    commands,
    connectionRemovedAfterError,
    hostConnection,
    hostPeer,
    session,
    throwingHostConnection,
  });
}
