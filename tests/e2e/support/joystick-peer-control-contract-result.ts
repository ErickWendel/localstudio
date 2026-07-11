import type { PresenterPeerControlClientLifecycleResult } from './presenter-peer-control-client-lifecycle';
import type { PresenterPeerControlHostLifecycleResult } from './presenter-peer-control-host-lifecycle-result';
import type { PresenterPeerOpenLifecycleResult } from './presenter-peer-open-lifecycle';
import type { PresenterPeerStreamPublisherLifecycleResult } from './presenter-peer-stream-publisher-lifecycle';
import type { PresenterPeerStreamReceiverLifecycleResult } from './presenter-peer-stream-receiver-lifecycle';

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

type JoystickPeerControlContractResultInput = {
  client: PresenterPeerControlClientLifecycleResult;
  host: PresenterPeerControlHostLifecycleResult;
  peerOpen: PresenterPeerOpenLifecycleResult;
  publisher: PresenterPeerStreamPublisherLifecycleResult;
  receiver: PresenterPeerStreamReceiverLifecycleResult;
};

export function createJoystickPeerControlContractResult({
  client,
  host,
  peerOpen,
  publisher,
  receiver,
}: JoystickPeerControlContractResultInput): JoystickPeerControlContractResult {
  return {
    answeredStreamCall: publisher.answeredStreamCall,
    callClosed: publisher.callClosed,
    callErrored: publisher.callErrored,
    clientCommandFailed: client.commandFailed,
    clientCommandSent: client.commandSent,
    clientPreviewBatchCount: client.previewBatchCount,
    clientRequestStateSent: client.requestStateSent,
    clientStateCount: client.stateCount,
    clientStatuses: client.statuses,
    closedConnectionCount: host.closedConnectionCount,
    commandCount: host.commandCount,
    connectionRemovedAfterError: host.connectionRemovedAfterError,
    destroyedPeerCount: Number(host.destroyedPeer) + Number(publisher.destroyedPeer),
    initialStateMessages: host.initialStateMessages,
    peerOpenResolved: peerOpen.peerOpenResolved,
    previewMessages: host.previewMessages,
    publishedStateMessages: host.publishedStateMessages,
    receiverClearedStream: receiver.clearedStream,
    receiverGotStream: receiver.gotStream,
    receiverStatuses: receiver.statuses,
    requestedStateMessages: host.requestedStateMessages,
    session: host.session,
    streamPeerId: publisher.streamPeerId,
    timeoutMessage: peerOpen.timeoutMessage,
  };
}
