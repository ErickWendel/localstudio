import type { runPresenterPeerControlClientLifecycle } from './presenter-peer-control-client-lifecycle';
import type { runPresenterPeerControlHostLifecycle } from './presenter-peer-control-host-lifecycle';
import type { runPresenterPeerOpenLifecycle } from './presenter-peer-open-lifecycle';
import type { runPresenterPeerStreamPublisherLifecycle } from './presenter-peer-stream-publisher-lifecycle';
import type { runPresenterPeerStreamReceiverLifecycle } from './presenter-peer-stream-receiver-lifecycle';
import {
  createJoystickPeerControlContractResult,
  type JoystickPeerControlContractResult,
} from './joystick-peer-control-contract-result';

type JoystickPeerControlContractScenarioInput = {
  runPresenterPeerControlClientLifecycle: typeof runPresenterPeerControlClientLifecycle;
  runPresenterPeerControlHostLifecycle: typeof runPresenterPeerControlHostLifecycle;
  runPresenterPeerOpenLifecycle: typeof runPresenterPeerOpenLifecycle;
  runPresenterPeerStreamPublisherLifecycle: typeof runPresenterPeerStreamPublisherLifecycle;
  runPresenterPeerStreamReceiverLifecycle: typeof runPresenterPeerStreamReceiverLifecycle;
  sourceRoot: string;
  testSupportSourceRoot: string;
};

export async function runJoystickPeerControlContractScenario({
  runPresenterPeerControlClientLifecycle,
  runPresenterPeerControlHostLifecycle,
  runPresenterPeerOpenLifecycle,
  runPresenterPeerStreamPublisherLifecycle,
  runPresenterPeerStreamReceiverLifecycle,
  sourceRoot,
  testSupportSourceRoot,
}: JoystickPeerControlContractScenarioInput): Promise<JoystickPeerControlContractResult> {
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

  return createJoystickPeerControlContractResult({ client, host, peerOpen, publisher, receiver });
}
