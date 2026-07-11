import type { runPresenterPeerControlClientLifecycle } from './presenter-peer-control-client-lifecycle';
import type { runPresenterPeerControlHostLifecycle } from './presenter-peer-control-host-lifecycle';
import type { runPresenterPeerOpenLifecycle } from './presenter-peer-open-lifecycle';
import type { runPresenterPeerStreamPublisherLifecycle } from './presenter-peer-stream-publisher-lifecycle';
import type { runPresenterPeerStreamReceiverLifecycle } from './presenter-peer-stream-receiver-lifecycle';

type PresenterPeerTransportContractScenarioInput = {
  presenterRemoteSourceRoot: string;
  runPresenterPeerControlClientLifecycle: typeof runPresenterPeerControlClientLifecycle;
  runPresenterPeerControlHostLifecycle: typeof runPresenterPeerControlHostLifecycle;
  runPresenterPeerOpenLifecycle: typeof runPresenterPeerOpenLifecycle;
  runPresenterPeerStreamPublisherLifecycle: typeof runPresenterPeerStreamPublisherLifecycle;
  runPresenterPeerStreamReceiverLifecycle: typeof runPresenterPeerStreamReceiverLifecycle;
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

export async function runPresenterPeerTransportContractScenario({
  presenterRemoteSourceRoot,
  runPresenterPeerControlClientLifecycle,
  runPresenterPeerControlHostLifecycle,
  runPresenterPeerOpenLifecycle,
  runPresenterPeerStreamPublisherLifecycle,
  runPresenterPeerStreamReceiverLifecycle,
  testSupportSourceRoot,
}: PresenterPeerTransportContractScenarioInput): Promise<PresenterPeerTransportContractResult> {
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
