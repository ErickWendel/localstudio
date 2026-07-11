import { EditorAppPage } from '../pages/editor-app.page';
import { expect, test } from '../support/journey-test';
import { presenterProtocolFixture } from '../support/presenter-protocol-fixture';
import { evaluatePresenterProtocolValidatorContract } from './presenter-protocol-validator-contract-browser';
import { serviceContractsSupport } from './service-contracts-support';

test('executes presenter protocol validator contracts in the browser runtime', async ({ page }) => {
  const editor = new EditorAppPage(page, serviceContractsSupport.getServer().baseURL);
  await editor.gotoNewProject();

  const result = await page.evaluate(evaluatePresenterProtocolValidatorContract, {
    commands: presenterProtocolFixture.createCommands(),
    presenterRemoteSourceRoot: serviceContractsSupport.presenterRemoteSourceRoot,
    preview: presenterProtocolFixture.createPreview(),
    state: presenterProtocolFixture.createState(),
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
