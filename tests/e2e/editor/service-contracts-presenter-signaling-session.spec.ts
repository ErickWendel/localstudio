import { expect, test } from '../support/journey-test';
import { presenterSignalingContractPage } from './presenter-signaling-contract-page';
import { evaluatePresenterSignalingSessionContract } from './presenter-signaling-session-contract-browser';
import { serviceContractsSupport } from './service-contracts-support';

test('executes presenter signaling session lifecycle contracts in the browser runtime', async ({
  page,
}) => {
  const result = await presenterSignalingContractPage.run(
    page,
    serviceContractsSupport.getServer().baseURL,
    evaluatePresenterSignalingSessionContract,
    { presenterRemoteSourceRoot: serviceContractsSupport.presenterRemoteSourceRoot },
  );

  expect(result).toMatchObject({
    connectedCount: 1,
    controllerClosed: true,
    lookupCode: 'ABCD-1234',
    missingConnection: undefined,
    missingControllerClosed: false,
    sessionAfterControllerClose: { connectedControllerCount: 0 },
    sessionClosed: true,
    sessionClosedAgain: false,
    singleActiveCode: 'ABCD-1234',
  });
});
