import { EditorAppPage } from '../pages/editor-app.page';
import { expect, test } from '../support/journey-test';
import { evaluatePresenterProtocolValidatorContract } from './presenter-protocol-validator-contract-browser';
import { presenterProtocolCommandFixture } from './presenter-protocol-command-fixture';
import { presenterProtocolPreviewFixture } from './presenter-protocol-preview-fixture';
import { presenterProtocolStateFixture } from './presenter-protocol-state-fixture';
import { serviceContractsSupport } from './service-contracts-support';

test('executes presenter protocol validator contracts in the browser runtime', async ({ page }) => {
  const editor = new EditorAppPage(page, serviceContractsSupport.getServer().baseURL);
  await editor.gotoNewProject();

  const result = await page.evaluate(evaluatePresenterProtocolValidatorContract, {
    commands: presenterProtocolCommandFixture.createCommands(),
    presenterRemoteSourceRoot: serviceContractsSupport.presenterRemoteSourceRoot,
    preview: presenterProtocolPreviewFixture.createPreview(),
    state: presenterProtocolStateFixture.createState(),
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
