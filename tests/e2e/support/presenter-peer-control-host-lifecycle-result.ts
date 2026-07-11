import { presenterPeerControlMessagePredicates } from './presenter-peer-control-message-predicates';

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

type PresenterPeerControlHostLifecycleResultInput = {
  commands: unknown[];
  connectionRemovedAfterError: boolean;
  hostConnection: {
    sentMessages: unknown[];
    wasClosed: boolean;
  };
  hostPeer: {
    destroyed: boolean;
  };
  session: PresenterPeerControlHostLifecycleResult['session'];
  throwingHostConnection: {
    wasClosed: boolean;
  };
};

export function createPresenterPeerControlHostLifecycleResult({
  commands,
  connectionRemovedAfterError,
  hostConnection,
  hostPeer,
  session,
  throwingHostConnection,
}: PresenterPeerControlHostLifecycleResultInput): PresenterPeerControlHostLifecycleResult {
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
