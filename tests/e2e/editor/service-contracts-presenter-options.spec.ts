import { EditorAppPage } from '../pages/editor-app.page';
import { expect, test } from '../support/journey-test';
import { evaluatePresenterOptionsContract } from './presenter-options-contract-browser';
import { serviceContractsSupport } from './service-contracts-support';

test('executes presenter peer options and timer contracts in the browser runtime', async ({ page }) => {
  const editor = new EditorAppPage(page, serviceContractsSupport.getServer().baseURL);
  await editor.gotoNewProject();

  const result = await page.evaluate(evaluatePresenterOptionsContract, {
    presenterRemoteSourceRoot: serviceContractsSupport.presenterRemoteSourceRoot,
  });

  expect(result).toEqual({
    missingPeerOptions: undefined,
    peerOptions: { host: 'localhost', path: '/peerjs', port: 9000, secure: false },
    timers: ['00:00', '01:05', '01:01:01'],
  });
});
