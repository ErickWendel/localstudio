import { expect, test } from '../support/journey-test';
import { presenterSignalingContractPage } from './presenter-signaling-contract-page';
import { evaluatePresenterSignalingStateContract } from './presenter-signaling-state-contract-browser';
import { serviceContractsSupport } from './service-contracts-support';

test('executes presenter signaling state and command contracts in the browser runtime', async ({
  page,
}) => {
  const result = await presenterSignalingContractPage.run(
    page,
    serviceContractsSupport.getServer().baseURL,
    evaluatePresenterSignalingStateContract,
    { presenterRemoteSourceRoot: serviceContractsSupport.presenterRemoteSourceRoot },
  );

  expect(result).toMatchObject({
    anonymousCommandPublished: true,
    commandPublished: true,
    drainedCommands: [],
    statePublished: true,
    untrustedCommandPublished: false,
  });
  expect(result.commands.map((command) => command.type)).toEqual(['go-to-slide', 'previous-slide']);
  expect(result.publishedState).toMatchObject({
    connectedControllerCount: 1,
    notes: 'Remember the close',
    slideTitle: 'Intro',
  });
});
