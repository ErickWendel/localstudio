import {
  loadPresenterPeerControlModules,
  type PresenterPeerControlContractHarnessInput,
} from './presenter-peer-control-modules';
import { createPresenterPeerControlClientPreviewBatch } from './presenter-peer-control-client-preview-batch-fixture';
import { createPresenterPeerControlClientState } from './presenter-peer-control-client-state-fixture';
import { presenterPeerControlMessagePredicates } from './presenter-peer-control-message-predicates';

export type PresenterPeerControlClientLifecycleInput = PresenterPeerControlContractHarnessInput & {
  clientPeerId: string;
  presenterPeerId: string;
  terminalEvent: 'close' | 'error';
};

export type PresenterPeerControlClientLifecycleResult = {
  commandFailed: boolean;
  commandSent: boolean;
  destroyedPeer: boolean;
  previewBatchCount: number;
  requestStateSent: boolean;
  stateCount: number;
  statuses: string[];
};

export async function runPresenterPeerControlClientLifecycle({
  clientPeerId,
  presenterPeerId,
  terminalEvent,
  ...input
}: PresenterPeerControlClientLifecycleInput): Promise<PresenterPeerControlClientLifecycleResult> {
  const { PresenterRemotePeerControlClient, fakePeerTransport } = await loadPresenterPeerControlModules(input);
  const clientPeer = fakePeerTransport.createPeer(clientPeerId);
  const statuses: string[] = [];
  const states: unknown[] = [];
  const previewBatches: unknown[] = [];
  const client = new PresenterRemotePeerControlClient({
    onPreviewBatch: (batch) => previewBatches.push(batch),
    onState: (state) => states.push(state),
    onStatusChange: (status) => statuses.push(status),
    peerFactory: () => clientPeer as never,
    presenterPeerId,
  });

  await client.start();
  const clientConnection = clientPeer.lastDataConnection;
  clientConnection?.emit('data', createPresenterPeerControlClientPreviewBatch());
  clientConnection?.emit('data', createPresenterPeerControlClientState());
  clientConnection?.emit('data', { type: 'ignored' });
  const commandSent = client.sendCommand({ command: 'next', type: 'command' });
  if (clientConnection) clientConnection.throwOnSend = true;
  const commandFailed = !client.sendCommand({ command: 'previous', type: 'command' });
  if (terminalEvent === 'error') {
    clientConnection?.emit('error', new Error('client connection failed'));
  } else {
    clientConnection?.emit('close');
  }
  client.close();

  return {
    commandFailed,
    commandSent,
    destroyedPeer: clientPeer.destroyed,
    previewBatchCount: previewBatches.length,
    requestStateSent:
      clientConnection?.sentMessages.some((message) =>
        presenterPeerControlMessagePredicates.hasCommand(message, 'request-state'),
      ) ?? false,
    stateCount: states.length,
    statuses,
  };
}
