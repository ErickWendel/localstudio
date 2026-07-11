import { EditorAppPage } from '../pages/editor-app.page';
import { expect, test } from '../support/journey-test';
import { createPresenterProtocolCommands } from '../support/presenter-protocol-commands-fixture';
import { createPresenterProtocolPreview } from '../support/presenter-protocol-preview-fixture';
import { createPresenterProtocolState } from '../support/presenter-protocol-state-fixture';
import { evaluatePresenterProtocolValidatorContract } from './presenter-protocol-validator-contract-browser';
import { serviceContractsSupport } from './service-contracts-support';

test('executes presenter protocol validator contracts in the browser runtime', async ({ page }) => {
  const editor = new EditorAppPage(page, serviceContractsSupport.getServer().baseURL);
  await editor.gotoNewProject();

  const result = await page.evaluate(evaluatePresenterProtocolValidatorContract, {
    commands: createPresenterProtocolCommands(),
    presenterRemoteSourceRoot: serviceContractsSupport.presenterRemoteSourceRoot,
    preview: createPresenterProtocolPreview(),
    state: createPresenterProtocolState(),
  });

  expect(result).toMatchObject({
    invalidCommand: false,
    invalidPreviewBatch: false,
    invalidSession: false,
    invalidState: false,
    invalidStreamPreference: false,
    previewBatch: true,
    session: true,
    state: true,
    streamPreference: true,
  });
  expect(result.commandResults).toEqual(serviceContractsSupport.commandsAllTrue);
});
