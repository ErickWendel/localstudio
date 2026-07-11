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
    { runPresenterPeerControlClientLifecycle },
    { runPresenterPeerControlHostLifecycle },
    { runPresenterPeerOpenLifecycle },
    { runPresenterPeerStreamPublisherLifecycle },
    { runPresenterPeerStreamReceiverLifecycle },
  ] = (await Promise.all([
    import(`${testSupportSourceRoot}/presenter-peer-control-client-lifecycle.ts`),
    import(`${testSupportSourceRoot}/presenter-peer-control-host-lifecycle.ts`),
    import(`${testSupportSourceRoot}/presenter-peer-open-lifecycle.ts`),
    import(`${testSupportSourceRoot}/presenter-peer-stream-publisher-lifecycle.ts`),
    import(`${testSupportSourceRoot}/presenter-peer-stream-receiver-lifecycle.ts`),
  ])) as [
    typeof import('../support/presenter-peer-control-client-lifecycle'),
    typeof import('../support/presenter-peer-control-host-lifecycle'),
    typeof import('../support/presenter-peer-open-lifecycle'),
    typeof import('../support/presenter-peer-stream-publisher-lifecycle'),
    typeof import('../support/presenter-peer-stream-receiver-lifecycle'),
  ];
  const harnessInput = {
    presenterRemoteSourceRoot: sourceRoot,
    testSupportSourceRoot,
  };

  const host = await runPresenterPeerControlHostLifecycle({
    ...harnessInput,
    peerId: 'control-peer-1',
    presenterDeviceId: 'presenter-device-1',
    presenterLabel: 'Studio laptop',
  });
  const publisher = await runPresenterPeerStreamPublisherLifecycle({
    ...harnessInput,
    peerId: 'stream-peer-1',
  });
  const client = await runPresenterPeerControlClientLifecycle({
    ...harnessInput,
    clientPeerId: 'client-peer-1',
    presenterPeerId: 'control-peer-1',
    terminalEvent: 'close',
  });
  const receiver = await runPresenterPeerStreamReceiverLifecycle({
    ...harnessInput,
    failureMode: 'error-and-close',
    peerId: 'receiver-peer-1',
    streamPeerId: 'stream-peer-1',
  });
  const peerOpen = await runPresenterPeerOpenLifecycle({
    presenterRemoteSourceRoot: sourceRoot,
    timeoutMessage: 'expected timeout',
  });

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
