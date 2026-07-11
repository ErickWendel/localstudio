import type { JoystickPeerControlContractResult } from '../support/joystick-peer-control-contract-scenario';

export type JoystickPeerControlContractInput = {
  sourceRoot: string;
  testSupportSourceRoot: string;
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
    { runJoystickPeerControlContractScenario },
  ] = (await Promise.all([
    import(`${testSupportSourceRoot}/presenter-peer-control-client-lifecycle.ts`),
    import(`${testSupportSourceRoot}/presenter-peer-control-host-lifecycle.ts`),
    import(`${testSupportSourceRoot}/presenter-peer-open-lifecycle.ts`),
    import(`${testSupportSourceRoot}/presenter-peer-stream-publisher-lifecycle.ts`),
    import(`${testSupportSourceRoot}/presenter-peer-stream-receiver-lifecycle.ts`),
    import(`${testSupportSourceRoot}/joystick-peer-control-contract-scenario.ts`),
  ])) as [
    typeof import('../support/presenter-peer-control-client-lifecycle'),
    typeof import('../support/presenter-peer-control-host-lifecycle'),
    typeof import('../support/presenter-peer-open-lifecycle'),
    typeof import('../support/presenter-peer-stream-publisher-lifecycle'),
    typeof import('../support/presenter-peer-stream-receiver-lifecycle'),
    typeof import('../support/joystick-peer-control-contract-scenario'),
  ];

  return runJoystickPeerControlContractScenario({
    runPresenterPeerControlClientLifecycle,
    runPresenterPeerControlHostLifecycle,
    runPresenterPeerOpenLifecycle,
    runPresenterPeerStreamPublisherLifecycle,
    runPresenterPeerStreamReceiverLifecycle,
    sourceRoot,
    testSupportSourceRoot,
  });
}
