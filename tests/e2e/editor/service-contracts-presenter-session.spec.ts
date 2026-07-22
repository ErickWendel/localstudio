import { expect, test } from '../support/journey-test';
import { presenterSignalingContractPage } from './presenter-signaling-contract-page';
import { evaluatePresenterSessionServiceContract } from './presenter-session-service-contract-browser';
import { serviceContractsSupport } from './service-contracts-support';

test('executes presenter session service contracts in the browser runtime', async ({ page }) => {
  const result = await presenterSignalingContractPage.run(
    page,
    serviceContractsSupport.getServer().baseURL,
    evaluatePresenterSessionServiceContract,
    {
      editorSourceRoot: serviceContractsSupport.editorSourceRoot,
      testSupportSourceRoot: serviceContractsSupport.testSupportSourceRoot,
    },
  );

  expect(result).toMatchObject({
    blockedStatus: 'blocked',
    duplicateSessionReused: true,
    hostCloseCount: 1,
    hostOpenCount: 1,
    legacyCloseCount: 1,
    legacyPublishCount: 2,
    openedPopupHrefIncludesPresenter: true,
    openedStatus: 'opened',
    popupClosed: true,
    remoteSession: {
      controlPeerId: 'peer-control-1',
      qrUrl: 'https://remote.localstudio.test/joystick/?peer=peer-control-1',
      transport: 'peerjs',
    },
  });
  expect(result.commandNames).toEqual([
    'update-notes',
    'go-to-page',
    'pause-timer',
    'next',
    'update-stream-peer',
    'go-to-page',
    'next',
    'save-recording',
    'close',
    'previous',
    'request-state',
    'start-presenting',
  ]);
  expect(result.legacyCommandNames).toEqual(['resume-timer', 'reset-timer']);
  expect(result.hostPreviewBatchCount).toBeGreaterThan(0);
  expect(result.hostStateCount).toBeGreaterThanOrEqual(4);
  expect(result.popupCommandCount).toBe(1);
  expect(result.popupStateCount).toBeGreaterThanOrEqual(2);
});
