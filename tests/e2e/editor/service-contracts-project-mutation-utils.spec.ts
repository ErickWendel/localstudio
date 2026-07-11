import { EditorAppPage } from '../pages/editor-app.page';
import { expect, test } from '../support/journey-test';
import { serviceContractsSupport } from './service-contracts-support';
import { mirrorFileContractProject } from './mirror-file-contract-project';
import { evaluateProjectMutationUtilsContract } from './project-mutation-utils-contract-browser';

test('executes project mutation utility contracts in the browser runtime', async ({ page }) => {
  const editor = new EditorAppPage(page, serviceContractsSupport.getServer().baseURL);
  await editor.gotoNewProject();

  const result = await page.evaluate(
    evaluateProjectMutationUtilsContract,
    mirrorFileContractProject.createProject(),
  );

  expect(result.touchedName).toBe('Mirror Contract');
  expect(Date.parse(result.timestamp)).not.toBeNaN();
  expect(Date.parse(result.touchedUpdatedAt)).not.toBeNaN();
});
