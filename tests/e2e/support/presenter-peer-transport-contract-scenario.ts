import type { runPresenterPeerControlClientLifecycle } from './presenter-peer-control-client-lifecycle';
import type { runPresenterPeerControlHostLifecycle } from './presenter-peer-control-host-lifecycle';
import type { runPresenterPeerOpenLifecycle } from './presenter-peer-open-lifecycle';
import type { runPresenterPeerStreamPublisherLifecycle } from './presenter-peer-stream-publisher-lifecycle';
import type { runPresenterPeerStreamReceiverLifecycle } from './presenter-peer-stream-receiver-lifecycle';
import {
  createPresenterPeerTransportContractResult,
  type PresenterPeerTransportContractResult,
} from './presenter-peer-transport-contract-result';

type PresenterPeerTransportContractScenarioInput = {
  presenterRemoteSourceRoot: string;
  runPresenterPeerControlClientLifecycle: typeof runPresenterPeerControlClientLifecycle;
  runPresenterPeerControlHostLifecycle: typeof runPresenterPeerControlHostLifecycle;
  runPresenterPeerOpenLifecycle: typeof runPresenterPeerOpenLifecycle;
  runPresenterPeerStreamPublisherLifecycle: typeof runPresenterPeerStreamPublisherLifecycle;
  runPresenterPeerStreamReceiverLifecycle: typeof runPresenterPeerStreamReceiverLifecycle;
  testSupportSourceRoot: string;
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

  return createPresenterPeerTransportContractResult({ client, host, peerOpen, publisher, receiver });
}
