import { expect, test } from '../support/journey-test';
import { presenterSignalingContractPage } from './presenter-signaling-contract-page';
import { evaluatePresenterPeerTransportContract } from './presenter-peer-transport-contract-browser';
import { serviceContractsSupport } from './service-contracts-support';

test('executes presenter PeerJS transport contracts in the browser runtime', async ({ page }) => {
  const result = await presenterSignalingContractPage.run(
    page,
    serviceContractsSupport.getServer().baseURL,
    evaluatePresenterPeerTransportContract,
    {
      presenterRemoteSourceRoot: serviceContractsSupport.presenterRemoteSourceRoot,
      testSupportSourceRoot: serviceContractsSupport.testSupportSourceRoot,
    },
  );

  expect(result.clientStatuses).toEqual(['connecting', 'connected', 'failed']);
  expect(result.commandCount).toBe(1);
  expect(result.destroyedPeerCount).toBe(4);
  expect(result.hostClosed).toBe(true);
  expect(result.hostOpenCount).toBe(1);
  expect(result.previewBatchCount).toBe(1);
  expect(result.publisherAnsweredCall).toBe(true);
  expect(result.receiverStatuses.slice(0, 2)).toEqual(['connecting', 'connected']);
  expect(result.receiverStatuses.filter((status) => status === 'failed')).toHaveLength(2);
  expect(result.requestStateSent).toBe(true);
  expect(result.sentCommandFailed).toBe(true);
  expect(result.sentCommandSucceeded).toBe(true);
  expect(result.stateCount).toBe(1);
  expect(result.streamPeerId).toBe('publisher-peer');
  expect(result.timeoutMessage).toBe('transport timeout');
});
