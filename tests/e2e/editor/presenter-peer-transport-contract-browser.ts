export type PresenterPeerTransportContractInput = {
  presenterRemoteSourceRoot: string;
  testSupportSourceRoot: string;
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

export async function evaluatePresenterPeerTransportContract({
  presenterRemoteSourceRoot,
  testSupportSourceRoot,
}: PresenterPeerTransportContractInput): Promise<PresenterPeerTransportContractResult> {
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
    presenterRemoteSourceRoot,
    testSupportSourceRoot,
  };

  const host = await runPresenterPeerControlHostLifecycle({
    ...harnessInput,
    peerId: 'host-peer',
    presenterDeviceId: 'presenter-device',
    presenterLabel: 'Studio laptop',
  });
  const client = await runPresenterPeerControlClientLifecycle({
    ...harnessInput,
    clientPeerId: 'client-peer',
    presenterPeerId: 'host-peer',
    terminalEvent: 'error',
  });
  const publisher = await runPresenterPeerStreamPublisherLifecycle({
    ...harnessInput,
    peerId: 'publisher-peer',
  });
  const receiver = await runPresenterPeerStreamReceiverLifecycle({
    ...harnessInput,
    failureMode: 'close',
    peerId: 'receiver-peer',
    streamPeerId: publisher.streamPeerId,
  });
  const peerOpen = await runPresenterPeerOpenLifecycle({
    presenterRemoteSourceRoot,
    timeoutMessage: 'transport timeout',
  });

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
