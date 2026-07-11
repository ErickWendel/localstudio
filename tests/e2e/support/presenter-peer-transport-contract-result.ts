import type { PresenterPeerControlClientLifecycleResult } from './presenter-peer-control-client-lifecycle';
import type { PresenterPeerControlHostLifecycleResult } from './presenter-peer-control-host-lifecycle-result';
import type { PresenterPeerOpenLifecycleResult } from './presenter-peer-open-lifecycle';
import type { PresenterPeerStreamPublisherLifecycleResult } from './presenter-peer-stream-publisher-lifecycle';
import type { PresenterPeerStreamReceiverLifecycleResult } from './presenter-peer-stream-receiver-lifecycle';

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

type PresenterPeerTransportContractResultInput = {
  client: PresenterPeerControlClientLifecycleResult;
  host: PresenterPeerControlHostLifecycleResult;
  peerOpen: PresenterPeerOpenLifecycleResult;
  publisher: PresenterPeerStreamPublisherLifecycleResult;
  receiver: PresenterPeerStreamReceiverLifecycleResult;
};

export function createPresenterPeerTransportContractResult({
  client,
  host,
  peerOpen,
  publisher,
  receiver,
}: PresenterPeerTransportContractResultInput): PresenterPeerTransportContractResult {
  return {
    clientStatuses: client.statuses,
    commandCount: host.commandCount,
    destroyedPeerCount:
      Number(host.destroyedPeer) +
      Number(client.destroyedPeer) +
      Number(publisher.destroyedPeer) +
      Number(receiver.destroyedPeer),
    hostClosed: host.hostClosed,
    hostOpenCount: 1,
    previewBatchCount: client.previewBatchCount,
    publisherAnsweredCall: publisher.answeredStreamCall,
    receiverStatuses: receiver.statuses,
    requestStateSent: client.requestStateSent,
    sentCommandFailed: client.commandFailed,
    sentCommandSucceeded: client.commandSent,
    stateCount: client.stateCount,
    streamPeerId: publisher.streamPeerId,
    timeoutMessage: peerOpen.timeoutMessage,
  };
}
