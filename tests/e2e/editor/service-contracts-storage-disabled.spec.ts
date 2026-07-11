import { EditorAppPage } from '../pages/editor-app.page';
import { expect, test } from '../support/journey-test';
import { serviceContractsSupport } from './service-contracts-support';
import { evaluateStorageDisabledContract } from './storage-disabled-contract-browser';
import { createStorageContractProject } from './storage-contract-project';

test('executes disabled and denied project repository contracts in the browser runtime', async ({
  page,
}) => {
  const editor = new EditorAppPage(page, serviceContractsSupport.getServer().baseURL);
  await editor.gotoNewProject();

  const result = await page.evaluate(
    evaluateStorageDisabledContract,
    createStorageContractProject(),
  );

  expect(result).toEqual({
    disabledLoad: null,
    permissionError:
      'LocalStudio.dev needs permission to read and write the selected project folder.',
  });
});
